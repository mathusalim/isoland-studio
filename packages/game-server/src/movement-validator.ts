import type { Vec2 } from '@isoland/shared'
import {
  PLAYER_MAX_SPEED,
  TICK_DURATION,
  SPEED_TOLERANCE_FACTOR,
  TIMESTAMP_DRIFT_MS,
} from '@isoland/shared'

export type ValidationFailReason =
  | 'direction_invalid' // NaN or Infinity in direction components
  | 'not_normalized' // magnitude not ~0 or ~1
  | 'seq_stale' // duplicate or replayed sequence number
  | 'speed_exceeded' // cumulative movement this tick exceeds allowed maximum
  | 'timestamp_drift' // client clock outside acceptable window (informational)

export type ValidationResult = { ok: true } | { ok: false; reason: ValidationFailReason }

// Maximum tiles a player may travel from their tick-start position in one tick
export const MAX_DIST_PER_TICK = PLAYER_MAX_SPEED * (TICK_DURATION / 1000) * SPEED_TOLERANCE_FACTOR

// Validates direction vector — must be finite and either zero or unit-length.
export const validateDirection = (dir: Vec2): ValidationResult => {
  if (!Number.isFinite(dir.x) || !Number.isFinite(dir.y)) {
    return { ok: false, reason: 'direction_invalid' }
  }
  const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y)
  // Allow exactly zero (stopped) or ~1 (moving); reject anything in between
  if (mag > 0.01 && Math.abs(mag - 1.0) > 0.01) {
    return { ok: false, reason: 'not_normalized' }
  }
  return { ok: true }
}

// Rejects duplicate / replayed sequence numbers.
// Gaps are allowed — the tick processor handles them with last-known direction.
export const validateSeq = (seq: number, lastProcessedSeq: number): ValidationResult => {
  if (seq <= lastProcessedSeq) return { ok: false, reason: 'seq_stale' }
  return { ok: true }
}

// Checks cumulative displacement from tickStartPos against the per-tick speed cap.
// tickStartPos must be the confirmed position BEFORE any inputs in the current tick.
export const validateSpeed = (tickStartPos: Vec2, candidatePos: Vec2): ValidationResult => {
  const dx = candidatePos.x - tickStartPos.x
  const dy = candidatePos.y - tickStartPos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > MAX_DIST_PER_TICK) return { ok: false, reason: 'speed_exceeded' }
  return { ok: true }
}

// Returns true when the client timestamp deviates from server time beyond the drift window.
// Callers should log but NOT reject on this alone — bad clocks are common on mobile.
export const hasTimestampDrift = (clientTs: number, serverTs: number): boolean =>
  Math.abs(clientTs - serverTs) > TIMESTAMP_DRIFT_MS
