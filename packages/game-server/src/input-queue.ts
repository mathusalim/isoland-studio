import type { movement } from '@isoland/shared'
import { INPUT_QUEUE_MAX, INPUT_EXPIRY_MS } from '@isoland/shared'

export interface InputQueue {
  // Returns overflow=true when the oldest entry was dropped to make room.
  push(input: movement.PlayerInput): { overflow: boolean }
  // Returns all non-expired inputs sorted ascending by seq, then clears the queue.
  drain(): movement.PlayerInput[]
  size(): number
}

// Per-player bounded input queue. Inputs are dequeued once per server tick.
export const createInputQueue = (): InputQueue => {
  const buf: movement.PlayerInput[] = []

  const push = (input: movement.PlayerInput): { overflow: boolean } => {
    // Discard already-stale inputs before they enter the queue
    if (Date.now() - input.timestamp > INPUT_EXPIRY_MS) return { overflow: false }

    let overflow = false
    if (buf.length >= INPUT_QUEUE_MAX) {
      buf.shift() // drop the oldest entry
      overflow = true
    }
    buf.push(input)
    return { overflow }
  }

  const drain = (): movement.PlayerInput[] => {
    if (buf.length === 0) return []
    const now = Date.now()
    const result = buf
      .filter((i) => now - i.timestamp <= INPUT_EXPIRY_MS)
      .sort((a, b) => a.seq - b.seq)
    buf.length = 0
    return result
  }

  const size = (): number => buf.length

  return { push, drain, size }
}
