import {
  movement,
  resolveMovement,
  PLAYER_BOUNDS,
  canDodge,
  startDodge,
  tickDodge,
  isDodgeActive,
  getDodgeSpeedMultiplier,
  defaultPlayerState,
  DODGE_SPEED_MULTIPLIER,
} from '@isoland/shared'
import type { Vec2, TileMap, PlayerState } from '@isoland/shared'

export interface PredictionBuffer {
  add(input: movement.PlayerInput, mapSize: number, tileMap?: TileMap): void
  // Reconcile on receiving a server snapshot:
  //   1. drop all pending inputs with seq <= snapshot.lastProcessedSeq
  //   2. reset movement + dodge state to server authority
  //   3. re-apply remaining unacked inputs to arrive at the current predicted position
  reconcile(snapshot: movement.ServerSnapshot, mapSize: number, tileMap?: TileMap): void
  getState(): movement.MovementState
  getPlayerState(): PlayerState
}

// Creates a client-side prediction buffer seeded at the given spawn position.
export const createPredictionBuffer = (spawnPos: Vec2): PredictionBuffer => {
  let movState: movement.MovementState = {
    position: { ...spawnPos },
    velocity: { x: 0, y: 0 },
  }
  let playerState: PlayerState = defaultPlayerState()
  let pending: movement.PlayerInput[] = []

  // Apply a single input against the current movement + dodge state.
  // Uses input.timestamp as the authoritative clock for dodge transitions.
  const applyOne = (input: movement.PlayerInput, mapSize: number, tileMap?: TileMap): void => {
    const now = input.timestamp

    playerState = tickDodge(playerState, now)

    if (input.dodge && canDodge(playerState, now)) {
      playerState = startDodge(playerState, input, now)
    }

    const dodging = isDodgeActive(playerState, now)
    const effectiveDir = dodging ? playerState.dodge.direction : input.direction
    const speedMult = dodging ? DODGE_SPEED_MULTIPLIER : getDodgeSpeedMultiplier(playerState)
    const effectiveInput = { ...input, direction: effectiveDir }

    const from = { ...movState.position }
    movState = movement.applyInput(movState, effectiveInput, mapSize, speedMult)

    if (tileMap) {
      const resolved = resolveMovement(from, movState.position, PLAYER_BOUNDS, tileMap)
      movState = { ...movState, position: resolved.position }
    }

    if (effectiveDir.x !== 0 || effectiveDir.y !== 0) {
      playerState = { ...playerState, lastMoveDir: effectiveDir }
    }
  }

  const add = (input: movement.PlayerInput, mapSize: number, tileMap?: TileMap): void => {
    applyOne(input, mapSize, tileMap)
    pending.push(input)
  }

  const reconcile = (
    snapshot: movement.ServerSnapshot,
    mapSize: number,
    tileMap?: TileMap,
  ): void => {
    pending = pending.filter((p) => p.seq > snapshot.lastProcessedSeq)
    movState = { position: { ...snapshot.position }, velocity: { ...snapshot.velocity } }

    // Sync dodge state from server authority
    if (snapshot.dodging) {
      playerState = {
        ...playerState,
        dodge: {
          ...playerState.dodge,
          active: true,
          startTime: snapshot.dodgeStartTime,
          lastDodgeTime: snapshot.dodgeStartTime,
        },
      }
    } else {
      // Server says not dodging — cancel any locally-predicted dodge
      playerState = { ...playerState, dodge: { ...playerState.dodge, active: false } }
    }

    for (const input of pending) {
      applyOne(input, mapSize, tileMap)
    }
  }

  return {
    add,
    reconcile,
    getState: () => movState,
    getPlayerState: () => playerState,
  }
}
