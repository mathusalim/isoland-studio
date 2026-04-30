import type { Vec2 } from './types/math.js'

export const PLAYER_SPEED = 6 // tiles per second

export interface PlayerInput {
  seq: number
  direction: Vec2 // normalized Vec2 — magnitude is always 0 or 1
  dt: number // seconds; stored so the server replays with the exact same dt the client used
  timestamp: number // client clock (ms since epoch)
  dodge: boolean // true only on the frame the dodge key was pressed (one-shot)
}

export interface MovementState {
  position: Vec2
  velocity: Vec2 // tiles per second
}

export interface ServerSnapshot {
  lastProcessedSeq: number
  position: Vec2
  velocity: Vec2
  dodging: boolean
  dodgeStartTime: number // 0 when not dodging; used to sync client iframe window
  invincible: boolean
}

// Pure movement step — identical on client and server.
// speedMultiplier is provided by the caller after applying dodge state.
export const applyInput = (
  state: MovementState,
  input: PlayerInput,
  mapSize: number,
  speedMultiplier = 1.0,
): MovementState => {
  const speed = PLAYER_SPEED * speedMultiplier
  const nx = Math.max(
    0,
    Math.min(mapSize - 1, state.position.x + input.direction.x * speed * input.dt),
  )
  const ny = Math.max(
    0,
    Math.min(mapSize - 1, state.position.y + input.direction.y * speed * input.dt),
  )
  return {
    position: { x: nx, y: ny },
    velocity: { x: input.direction.x * speed, y: input.direction.y * speed },
  }
}

// Clamp a position to the playable area without applying movement
export const clampToMap = (pos: Vec2, mapSize: number): Vec2 => ({
  x: Math.max(0, Math.min(mapSize - 1, pos.x)),
  y: Math.max(0, Math.min(mapSize - 1, pos.y)),
})
