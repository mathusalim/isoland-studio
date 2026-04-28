import { net } from '@isoland/shared'

type Handler<T extends net.MessageType> = (msg: Extract<net.NetMessage, { type: T }>) => void
type AnyHandler = (msg: net.NetMessage) => void

export type GameSocket = {
  send: (msg: net.NetMessage) => void
  on: <T extends net.MessageType>(type: T, handler: Handler<T>) => () => void
  close: () => void
  readonly connected: boolean
}

// Opens a WebSocket connection to the game server and returns a typed message bus.
// The returned `on` registers a handler for one message type and returns an unsubscribe fn.
export const createGameSocket = (url: string): GameSocket => {
  const ws = new WebSocket(url)
  const handlers = new Map<string, Set<AnyHandler>>()
  let _connected = false

  ws.addEventListener('open', () => {
    _connected = true
  })
  ws.addEventListener('close', () => {
    _connected = false
  })

  ws.addEventListener('message', (event: MessageEvent<string>) => {
    let msg: net.NetMessage
    try {
      msg = net.deserialize(event.data)
    } catch {
      return
    }
    handlers.get(msg.type)?.forEach((h) => h(msg))
  })

  const send = (msg: net.NetMessage): void => {
    if (ws.readyState === WebSocket.OPEN) ws.send(net.serialize(msg))
  }

  const on = <T extends net.MessageType>(type: T, handler: Handler<T>): (() => void) => {
    if (!handlers.has(type)) handlers.set(type, new Set())
    handlers.get(type)!.add(handler as AnyHandler)
    return () => handlers.get(type)?.delete(handler as AnyHandler)
  }

  const close = (): void => ws.close()

  return {
    send,
    on,
    close,
    get connected() {
      return _connected
    },
  }
}
