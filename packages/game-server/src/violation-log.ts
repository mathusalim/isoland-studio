export type ViolationType =
  | 'direction_invalid'
  | 'not_normalized'
  | 'seq_stale'
  | 'speed_exceeded'
  | 'queue_overflow'
  | 'timestamp_drift'
  | 'dodge_invalid'

export interface ViolationEvent {
  playerId: string
  type: ViolationType
  ts: number
  context: Record<string, unknown>
}

// Weight of each violation toward the rolling counter
const VIOLATION_WEIGHT: Record<ViolationType, number> = {
  direction_invalid: 1,
  not_normalized: 1,
  seq_stale: 0, // noise from network reordering, don't penalise
  speed_exceeded: 1,
  queue_overflow: 2,
  timestamp_drift: 0, // informational only
  dodge_invalid: 2, // client tried to dodge when server-side canDodge() was false
}

const SUSPICIOUS_THRESHOLD = 10
const KICK_THRESHOLD = 25
const WINDOW_MS = 60_000

export interface ViolationTracker {
  record(type: ViolationType, context: Record<string, unknown>): void
  getCount(): number
}

// Per-player rolling violation counter with a 60 s window.
// All events are written to the log regardless of thresholds — never discard data.
export const createViolationTracker = (
  playerId: string,
  onSuspicious: (id: string) => void,
  onKick: (id: string) => void,
): ViolationTracker => {
  let count = 0
  let windowStart = Date.now()
  let suspiciousEmitted = false
  let kicked = false

  const record = (type: ViolationType, context: Record<string, unknown>): void => {
    const now = Date.now()

    // Roll the window every 60 s
    if (now - windowStart >= WINDOW_MS) {
      count = 0
      windowStart = now
      suspiciousEmitted = false
      // Do NOT reset kicked — once a kick is issued, don't re-flag in the same session
    }

    const weight = VIOLATION_WEIGHT[type]
    count += weight

    // Always persist — callers downstream may pipe to a log aggregator
    const event: ViolationEvent = { playerId, type, ts: now, context }
    console.warn('[violation]', JSON.stringify(event))

    if (kicked) return

    if (count >= KICK_THRESHOLD) {
      kicked = true
      onKick(playerId)
    } else if (!suspiciousEmitted && count >= SUSPICIOUS_THRESHOLD) {
      suspiciousEmitted = true
      onSuspicious(playerId)
    }
  }

  return { record, getCount: () => count }
}
