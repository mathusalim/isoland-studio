import type { Vec2 } from './types/math.js'

export interface DodgeState {
  active: boolean
  direction: Vec2 // locked at dodge start, never mutated during roll
  startTime: number // server tick time
  lastDodgeTime: number // tracks cooldown — set to startTime on each dodge
}

// Per-player logical state shared between client prediction and server tick
export interface PlayerState {
  dodge: DodgeState
  lastMoveDir: Vec2 // last non-zero movement direction; used for backward dodge
}

export const defaultDodgeState = (): DodgeState => ({
  active: false,
  direction: { x: 0.707, y: 0.707 }, // arbitrary fallback — only used if no prior movement
  startTime: 0,
  lastDodgeTime: 0,
})

export const defaultPlayerState = (): PlayerState => ({
  dodge: defaultDodgeState(),
  lastMoveDir: { x: 0, y: 0 },
})
