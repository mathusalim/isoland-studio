import type { Vec2 } from './types/math.js'

export const PLAYER_SPEED = 6 // tiles per second

export interface PlayerInput {
  seq: number
  direction: Vec2 // cardinal: each axis is -1, 0, or 1
  dt: number // seconds; stored so the server replays with the exact same dt the client used
  timestamp: number // client clock (ms since epoch)
}

export interface MovementState {
  position: Vec2
  velocity: Vec2 // tiles per second
}

export interface ServerSnapshot {
  lastProcessedSeq: number
  position: Vec2
  velocity: Vec2
}

// Pure movement step — identical on client and server.
// Applies direction * PLAYER_SPEED * dt to position, clamped to the playable area.
export const applyInput = (
  state: MovementState,
  input: PlayerInput,
  mapSize: number,
): MovementState => {
  const nx = Math.max(
    0,
    Math.min(mapSize - 1, state.position.x + input.direction.x * PLAYER_SPEED * input.dt),
  )
  const ny = Math.max(
    0,
    Math.min(mapSize - 1, state.position.y + input.direction.y * PLAYER_SPEED * input.dt),
  )
  return {
    position: { x: nx, y: ny },
    velocity: { x: input.direction.x * PLAYER_SPEED, y: input.direction.y * PLAYER_SPEED },
  }
}

// Clamp a position to the playable area without applying movement
export const clampToMap = (pos: Vec2, mapSize: number): Vec2 => ({
  x: Math.max(0, Math.min(mapSize - 1, pos.x)),
  y: Math.max(0, Math.min(mapSize - 1, pos.y)),
})
