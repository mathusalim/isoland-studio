// u32 sequence numbers — wraps at 2^32
const SEQ_MAX = 0x100000000
const SEQ_HALF = 0x80000000

// Returns the next sequence number, wrapping at u32 boundary
export const nextSeq = (seq: number): number => (seq + 1) % SEQ_MAX

// True if `incoming` is newer than `expected`, accounting for wrap-around
export const isNewer = (incoming: number, expected: number): boolean => {
  const diff = (incoming - expected + SEQ_MAX) % SEQ_MAX
  return diff > 0 && diff < SEQ_HALF
}

// Signed difference (incoming - base) in [-SEQ_HALF, SEQ_HALF)
export const seqDiff = (incoming: number, base: number): number => {
  const raw = (incoming - base + SEQ_MAX) % SEQ_MAX
  return raw >= SEQ_HALF ? raw - SEQ_MAX : raw
}
