import {
  movement,
  grid,
  canDodge,
  startDodge,
  tickDodge,
  isDodgeActive,
  isInvincible,
  getDodgeSpeedMultiplier,
  defaultPlayerState,
} from '@isoland/shared'
import type { Vec2, TileMap, PlayerState } from '@isoland/shared'
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
  dodging: boolean
  invincible: boolean
  dodgeStartTime: number
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
//   1. tickDodge() — advance/end any active dodge
//   2. drain() returns inputs sorted by seq, expired ones already filtered
//   3. Each input is validated (direction, seq, speed); failures are logged
//   4. Dodge requests are checked with canDodge() — invalid ones are penalised
//   5. Valid inputs run through applyInput() — same pure fn as the client
//   6. Collision resolution clamps the result to walkable world geometry
//   7. Final authoritative state is written back to the world registry
export const createPlayerTick = (
  entityId: string,
  callbacks: { onSuspicious: (id: string) => void; onKick: (id: string) => void },
  tileMap?: TileMap,
): PlayerTick => {
  let lastProcessedSeq = -1
  let playerState: PlayerState = defaultPlayerState()
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

    // Advance dodge state before processing this tick's inputs
    playerState = tickDodge(playerState, serverNow)

    const prevChunkKey = grid.tileChunkKey(p.position.x, p.position.y)
    const tickStartPos: Vec2 = { ...p.position }

    let state: movement.MovementState = {
      position: { ...p.position },
      velocity: { ...p.velocity },
    }
    let anyProcessed = false

    for (const input of inputs) {
      if (!validateSeq(input.seq, lastProcessedSeq).ok) continue

      const dirCheck = validateDirection(input.direction)
      if (!dirCheck.ok) {
        violations.record(dirCheck.reason, { seq: input.seq, direction: input.direction })
        continue
      }

      if (hasTimestampDrift(input.timestamp, serverNow)) {
        violations.record('timestamp_drift', {
          seq: input.seq,
          clientTs: input.timestamp,
          serverTs: serverNow,
          driftMs: input.timestamp - serverNow,
        })
      }

      // Handle dodge request
      if (input.dodge) {
        if (canDodge(playerState, serverNow)) {
          playerState = startDodge(playerState, input, serverNow)
        } else {
          violations.record('dodge_invalid', { seq: input.seq })
        }
      }

      // Compute effective direction and speed for this input
      const dodging = isDodgeActive(playerState, serverNow)
      const effectiveDir = dodging ? playerState.dodge.direction : input.direction
      const speedMult = getDodgeSpeedMultiplier(playerState)
      const effectiveInput = { ...input, direction: effectiveDir }

      const candidate = movement.applyInput(state, effectiveInput, mapSize, speedMult)

      const speedCheck = validateSpeed(tickStartPos, candidate.position, dodging)
      if (!speedCheck.ok) {
        violations.record('speed_exceeded', {
          seq: input.seq,
          startPos: tickStartPos,
          candidatePos: candidate.position,
          dodging,
        })
        lastProcessedSeq = input.seq
        anyProcessed = true
        continue
      }

      const resolvedPos = tileMap
        ? validateCollision(state.position, candidate.position, tileMap).position
        : candidate.position
      state = { ...candidate, position: resolvedPos }

      // Track last non-zero direction for backward-dodge support
      if (effectiveDir.x !== 0 || effectiveDir.y !== 0) {
        playerState = { ...playerState, lastMoveDir: effectiveDir }
      }

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
      dodging: isDodgeActive(playerState, serverNow),
      invincible: isInvincible(playerState, serverNow),
      dodgeStartTime: playerState.dodge.startTime,
    }
  }

  return { enqueue, processTick, getLastProcessedSeq: () => lastProcessedSeq }
}
