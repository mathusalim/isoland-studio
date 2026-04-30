import type { Vec2 } from './types/math.js'
import type { PlayerState } from './player-state.js'
import {
  DODGE_DURATION_MS,
  DODGE_SPEED_MULTIPLIER,
  DODGE_COOLDOWN_MS,
  DODGE_INVINCIBLE_MS,
  DODGE_IFRAME_OFFSET_MS,
} from './constants.js'

// Minimal shape required from an input — avoids importing movement.ts (circular dep)
interface DodgeInput {
  direction: Vec2
}

// Lock the roll direction:
//   moving  → dodge in current movement direction
//   stopped → dodge backward (reverse of last known direction)
//   no history → fallback diagonal
const lockDirection = (input: DodgeInput, lastMoveDir: Vec2): Vec2 => {
  const { x, y } = input.direction
  if (x !== 0 || y !== 0) return { x, y }
  if (lastMoveDir.x !== 0 || lastMoveDir.y !== 0) return { x: -lastMoveDir.x, y: -lastMoveDir.y }
  return { x: 0.707, y: 0.707 }
}

// Returns true when a dodge can start (not on cooldown, not already dodging)
export const canDodge = (state: PlayerState, now: number): boolean =>
  !state.dodge.active && now - state.dodge.lastDodgeTime >= DODGE_COOLDOWN_MS

// Returns a new state with dodge activated; pure — never mutates
export const startDodge = (state: PlayerState, input: DodgeInput, now: number): PlayerState => ({
  ...state,
  dodge: {
    active: true,
    direction: lockDirection(input, state.lastMoveDir),
    startTime: now,
    lastDodgeTime: now,
  },
})

// Advances dodge state: ends it once DODGE_DURATION_MS has elapsed
export const tickDodge = (state: PlayerState, now: number): PlayerState => {
  if (!state.dodge.active) return state
  if (now - state.dodge.startTime >= DODGE_DURATION_MS) {
    return { ...state, dodge: { ...state.dodge, active: false } }
  }
  return state
}

export const isDodgeActive = (state: PlayerState, now: number): boolean =>
  state.dodge.active && now - state.dodge.startTime < DODGE_DURATION_MS

// True during the invincibility window (IFRAME_OFFSET_MS after start, lasting INVINCIBLE_MS)
export const isInvincible = (state: PlayerState, now: number): boolean => {
  if (!isDodgeActive(state, now)) return false
  const elapsed = now - state.dodge.startTime
  return elapsed >= DODGE_IFRAME_OFFSET_MS && elapsed < DODGE_IFRAME_OFFSET_MS + DODGE_INVINCIBLE_MS
}

// Returns the speed multiplier to apply to movement during a dodge
export const getDodgeSpeedMultiplier = (state: PlayerState): number =>
  state.dodge.active ? DODGE_SPEED_MULTIPLIER : 1.0

// Normalized 0–1 progress toward dodge being ready again (0 = on cooldown, 1 = ready)
export const dodgeCooldownRemaining = (state: PlayerState, now: number): number => {
  if (state.dodge.active) return 0
  return Math.min(1, (now - state.dodge.lastDodgeTime) / DODGE_COOLDOWN_MS)
}
