import uWS from 'uWebSockets.js'
import { net } from '@isoland/shared'
import { addPlayer, removePlayer, movePlayer, getAoIPlayers, getAllPlayers } from './world/state.js'

const PORT = Number(process.env.PORT ?? 9001)
const TICK_RATE = 20
const TICK_MS = 1000 / TICK_RATE
const MAP_SIZE = 20

type SocketData = { sessionId: string }

// Active connections: sessionId → WebSocket
const sockets = new Map<string, uWS.WebSocket<SocketData>>()

const decode = (buf: ArrayBuffer): string => Buffer.from(buf).toString('utf8')

const broadcast = (msg: net.NetMessage, exclude?: string): void => {
  const raw = net.serialize(msg)
  for (const [sid, ws] of sockets) {
    if (sid !== exclude) ws.send(raw)
  }
}

const toSnapshot = (p: ReturnType<typeof getAllPlayers>[number]): net.EntitySnapshot => ({
  id: p.id,
  type: 'player',
  position: p.position,
  hp: 100,
  maxHp: 100,
  status: [],
  animState: 'idle',
})

uWS
  .App()
  .ws<SocketData>('/*', {
    open(ws) {
      const sessionId = crypto.randomUUID()
      ws.getUserData().sessionId = sessionId
      sockets.set(sessionId, ws)
      console.log(`[server] connected  ${sessionId}`)
    },

    message(ws, raw, isBinary) {
      if (isBinary) return
      const { sessionId } = ws.getUserData()
      let msg: net.NetMessage
      try {
        msg = net.deserialize(decode(raw))
      } catch {
        return
      }

      if (msg.type === net.MessageType.HANDSHAKE) {
        const spawnPos = {
          x: 1 + Math.floor(Math.random() * (MAP_SIZE - 2)),
          y: 1 + Math.floor(Math.random() * (MAP_SIZE - 2)),
        }
        addPlayer(sessionId, msg.payload.characterId, spawnPos)

        ws.send(
          net.serialize(
            net.createMessage('handshake_ack', {
              serverVersion: '0.1.0',
              sessionId,
              serverTime: Date.now(),
            }),
          ),
        )

        ws.send(
          net.serialize(
            net.createMessage('world_init', {
              zoneId: 'verdant-reach',
              tilemap: { columns: MAP_SIZE, rows: MAP_SIZE, cells: [], elevations: [] },
              entities: getAllPlayers().map(toSnapshot),
              serverTime: Date.now(),
            }),
          ),
        )

        // Tell everyone else a new player appeared
        broadcast(
          net.createMessage('entity_spawn', {
            ...toSnapshot({
              id: sessionId,
              name: msg.payload.characterId,
              position: spawnPos,
              currentChunk: '',
            }),
            placeholder: false,
          }),
          sessionId,
        )

        console.log(`[server] handshake  ${sessionId} @ ${spawnPos.x},${spawnPos.y}`)
        return
      }

      if (msg.type === net.MessageType.MOVE) {
        movePlayer(sessionId, msg.payload.destination, MAP_SIZE)
        return
      }
    },

    close(ws) {
      const { sessionId } = ws.getUserData()
      sockets.delete(sessionId)
      removePlayer(sessionId)
      broadcast(net.createMessage('entity_despawn', { id: sessionId }))
      console.log(`[server] disconnected ${sessionId}`)
    },
  })
  .listen(PORT, (token) => {
    if (token) console.log(`[server] :${PORT} @ ${TICK_RATE}hz`)
    else console.error(`[server] failed to listen :${PORT}`)
  })

let tickCount = 0

setInterval(() => {
  tickCount++
  const now = Date.now()

  for (const [sessionId, ws] of sockets) {
    const aoiPlayers = getAoIPlayers(sessionId)

    ws.send(
      net.serialize(
        net.createMessage('world_delta', {
          tick: tickCount,
          moves: aoiPlayers.map((p) => ({
            id: p.id,
            position: p.position,
            velocity: { x: 0, y: 0 },
            animState: 'idle' as const,
          })),
          health: [],
          status: [],
          resources: [],
          animations: [],
          spawns: [],
          despawns: [],
        }),
      ),
    )

    void now
  }
}, TICK_MS)
