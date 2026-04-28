// Clock offset utilities for client-server time synchronisation.
//
// The offset is computed once during the handshake using the standard NTP formula:
//   offset = ((serverReceive - clientSend) + (serverSend - clientReceive)) / 2
// After that, all server timestamps can be converted to local time and vice versa.

// Computes how far ahead (+) or behind (-) the server clock is relative to local time.
// Call this when the PONG arrives:
//   localSendTs    = timestamp inside the PING (PingPayload.clientTs)
//   serverReceiveTs = PongPayload.serverReceiveTs
//   localReceiveTs = Date.now() when the PONG was processed
export const computeClockOffset = (
  localSendTs: number,
  serverReceiveTs: number,
  localReceiveTs: number,
): number => {
  const roundTrip = localReceiveTs - localSendTs
  return serverReceiveTs - localSendTs - roundTrip / 2
}

// Converts a local timestamp to the equivalent server timestamp
export const toServerTime = (localTs: number, offset: number): number => localTs + offset

// Converts a server timestamp to the equivalent local timestamp
export const toLocalTime = (serverTs: number, offset: number): number => serverTs - offset
