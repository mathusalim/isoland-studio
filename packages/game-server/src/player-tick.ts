import { movement, grid } from '@isoland/shared'
import type { Vec2, TileMap } from '@isoland/shared'
import { getPlayer, setPlayerState } from './world/state.js'
import { createInputQueue } from './input-queue.js'
import { createViolationTracker } from './violation-log.js'
import {
  validateDirection,
  validateSeq,
  validateSpeed,
  validateCollision,
  hasTimestampDrift,
} from './movement-validator.js'

export type TickResult = {
  newPos: Vec2
  velocity: Vec2
  prevChunkKey: string
  nextChunkKey: string
}

export interface PlayerTick {
  enqueue(input: movement.PlayerInput): void
  // Drain the input queue and apply all valid inputs against the authoritative state.
  // Returns null when the queue was empty (nothing to process this tick).
  processTick(mapSize: number): TickResult | null
  getLastProcessedSeq(): number
}

// Per-player validated tick processor.
//
// Reconciliation loop (per tick):
//   1. drain() returns inputs sorted by seq, expired ones already filtered
//   2. Each input is validated (direction, seq, speed); failures are logged
//   3. Valid inputs run through applyInput() — same pure fn as the client
//   4. Collision resolution clamps the result to walkable world geometry
//   5. Final authoritative state is written back to the world registry
export const createPlayerTick = (
  entityId: string,
  callbacks: { onSuspicious: (id: string) => void; onKick: (id: string) => void },
  tileMap?: TileMap,
): PlayerTick => {
  let lastProcessedSeq = -1
  const queue = createInputQueue()
  const violations = createViolationTracker(entityId, callbacks.onSuspicious, callbacks.onKick)

  const enqueue = (input: movement.PlayerInput): void => {
    const { overflow } = queue.push(input)
    if (overflow) {
      violations.record('queue_overflow', { seq: input.seq, queueSize: queue.size() })
    }
  }

  const processTick = (mapSize: number): TickResult | null => {
    const inputs = queue.drain()
    if (inputs.length === 0) return null

    const p = getPlayer(entityId)
    if (!p) return null

    const serverNow = Date.now()
    const prevChunkKey = grid.tileChunkKey(p.position.x, p.position.y)

    // tickStartPos is the confirmed position before any inputs this tick.
    // Used as the reference point for the cumulative speed check.
    const tickStartPos: Vec2 = { ...p.position }

    let state: movement.MovementState = {
      position: { ...p.position },
      velocity: { ...p.velocity },
    }
    let anyProcessed = false

    for (const input of inputs) {
      // Silently skip duplicates / replayed seq numbers (normal under packet reorder)
      if (!validateSeq(input.seq, lastProcessedSeq).ok) continue

      // Hard reject bad direction vectors — potential manipulation
      const dirCheck = validateDirection(input.direction)
      if (!dirCheck.ok) {
        violations.record(dirCheck.reason, { seq: input.seq, direction: input.direction })
        continue
      }

      // Log clock skew — informational, not a reject condition
      if (hasTimestampDrift(input.timestamp, serverNow)) {
        violations.record('timestamp_drift', {
          seq: input.seq,
          clientTs: input.timestamp,
          serverTs: serverNow,
          driftMs: input.timestamp - serverNow,
        })
      }

      // Apply the same pure movement function the client used for prediction
      const candidate = movement.applyInput(state, input, mapSize)

      // Speed check: total displacement from tick start, not from last input.
      // This bounds cumulative movement regardless of how many inputs arrive per tick.
      const speedCheck = validateSpeed(tickStartPos, candidate.position)
      if (!speedCheck.ok) {
        violations.record('speed_exceeded', {
          seq: input.seq,
          startPos: tickStartPos,
          candidatePos: candidate.position,
        })
        // Advance seq so client doesn't stall, but keep last valid position
        lastProcessedSeq = input.seq
        anyProcessed = true
        continue
      }

      // Resolve against tile geometry; fall back to bare bounds clamp when no map is loaded
      const resolvedPos = tileMap
        ? validateCollision(state.position, candidate.position, tileMap).position
        : candidate.position
      state = { ...candidate, position: resolvedPos }
      lastProcessedSeq = input.seq
      anyProcessed = true
    }

    if (!anyProcessed) return null

    setPlayerState(entityId, state.position, state.velocity)
    const nextChunkKey = grid.tileChunkKey(state.position.x, state.position.y)

    return {
      newPos: { ...state.position },
      velocity: { ...state.velocity },
      prevChunkKey,
      nextChunkKey,
    }
  }

  return { enqueue, processTick, getLastProcessedSeq: () => lastProcessedSeq }
}
