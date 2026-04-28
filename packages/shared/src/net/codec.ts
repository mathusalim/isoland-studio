import type { NetMessage } from './messages.js'
import type { MessagePayloadMap } from './messages.js'

// Serialises a message to a JSON string for transmission
export const serialize = (msg: NetMessage): string => JSON.stringify(msg)

// Deserialises a raw JSON string to a NetMessage.
// Throws a SyntaxError if the string is not valid JSON.
// The caller is responsible for validating the result before use.
export const deserialize = (raw: string): NetMessage => JSON.parse(raw) as NetMessage

// Constructs a typed message, auto-filling seq and ts
let _seq = 0
export const createMessage = <T extends keyof MessagePayloadMap>(
  type: T,
  payload: MessagePayloadMap[T],
): Extract<NetMessage, { type: T }> => {
  _seq = (_seq + 1) % 0x100000000
  return { type, seq: _seq, ts: Date.now(), payload } as Extract<NetMessage, { type: T }>
}
