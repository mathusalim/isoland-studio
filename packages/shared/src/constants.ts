// Re-export from movement.ts as the canonical server-visible name
export { PLAYER_SPEED as PLAYER_MAX_SPEED } from './movement.js'

export const TICK_RATE = 20
export const TICK_DURATION = 1000 / TICK_RATE // 50 ms

export const INPUT_QUEUE_MAX = 60 // 3 s worth at 20 hz
export const INPUT_EXPIRY_MS = 1000 // discard inputs older than this

export const SPEED_TOLERANCE_FACTOR = 1.2 // headroom for legitimate timing drift
export const TIMESTAMP_DRIFT_MS = 500 // client clock window before logging

// Pixels per tile — for rendering only; all world positions are in tile units
export const TILE_SIZE = 64

// Player AABB half-extents in tile units (16 px and 12 px at 64 px/tile)
export const PLAYER_BOUNDS = { halfW: 0.25, halfH: 0.1875 }

// Dodge / roll parameters — shared by client prediction and server validation
export const DODGE_DURATION_MS = 300 // total roll duration
export const DODGE_SPEED_MULTIPLIER = 3.5 // speed multiplier vs normal move speed
export const DODGE_COOLDOWN_MS = 800 // measured from dodge START, not end
export const DODGE_INVINCIBLE_MS = 200 // length of invincibility window
export const DODGE_IFRAME_OFFSET_MS = 50 // delay before iframes begin after dodge start
