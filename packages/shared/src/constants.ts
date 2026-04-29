// Re-export from movement.ts as the canonical server-visible name
export { PLAYER_SPEED as PLAYER_MAX_SPEED } from './movement.js'

export const TICK_RATE = 20
export const TICK_DURATION = 1000 / TICK_RATE // 50 ms

export const INPUT_QUEUE_MAX = 60 // 3 s worth at 20 hz
export const INPUT_EXPIRY_MS = 1000 // discard inputs older than this

export const SPEED_TOLERANCE_FACTOR = 1.2 // headroom for legitimate timing drift
export const TIMESTAMP_DRIFT_MS = 500 // client clock window before logging
