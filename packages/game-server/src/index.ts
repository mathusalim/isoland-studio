import uWS from 'uWebSockets.js'
import { net } from '@isoland/shared'
import {
  addPlayer,
  removePlayer,
  getPlayer,
  getAoIPlayers,
  getPlayersInChunk,
  getAllPlayers,
} from './world/state.js'
import { onEntityPositionUpdate } from './world/entityUpdater.js'

const PORT = Number(process.env.PORT ?? 9001)
const TICK_RATE = 20
const TICK_MS = 1000 / TICK_RATE
const MAP_SIZE = 20

type SocketData = { sessionId: string }

// Active connections: sessionId → WebSocket
const sockets = new Map<string, uWS.WebSocket<SocketData>>()

const decode = (buf: ArrayBuffer): string => Buffer.from(buf).toString('utf8')

const toSnapshot = (p: ReturnType<typeof getAllPlayers>[number]): net.EntitySnapshot => ({
  id: p.id,
  type: 'player',
  position: p.position,
  hp: 100,
  maxHp: 100,
  status: [],
  animState: 'idle',
})

const sendTo = (sessionId: string, msg: net.NetMessage): void => {
  sockets.get(sessionId)?.send(net.serialize(msg))
}

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

        // world_init: only entities visible from spawn position
        ws.send(
          net.serialize(
            net.createMessage('world_init', {
              zoneId: 'verdant-reach',
              tilemap: { columns: MAP_SIZE, rows: MAP_SIZE, cells: [], elevations: [] },
              entities: getAoIPlayers(sessionId).map(toSnapshot),
              serverTime: Date.now(),
            }),
          ),
        )

        // Tell players in spawn AoI about the new arrival
        const spawnSnapshot = toSnapshot({ id: sessionId, name: msg.payload.characterId, position: spawnPos })
        for (const p of getAoIPlayers(sessionId)) {
          if (p.id === sessionId) continue
          sendTo(p.id, net.createMessage('entity_spawn', { ...spawnSnapshot, placeholder: false }))
        }

        console.log(`[server] handshake  ${sessionId} @ ${spawnPos.x},${spawnPos.y}`)
        return
      }

      if (msg.type === net.MessageType.MOVE) {
        const result = onEntityPositionUpdate(sessionId, msg.payload.destination, MAP_SIZE)
        if (!result?.chunkChanged) return

        const mover = getPlayer(sessionId)
        if (!mover) return
        const moverSnapshot = toSnapshot(mover)

        // Chunks the mover newly sees: mutual visibility gained
        for (const chunkKey of result.enteredChunks) {
          for (const p of getPlayersInChunk(chunkKey)) {
            if (p.id === sessionId) continue
            // mover now sees p
            sendTo(sessionId, net.createMessage('entity_spawn', { ...toSnapshot(p), placeholder: false }))
            // p now sees mover
            sendTo(p.id, net.createMessage('entity_spawn', { ...moverSnapshot, placeholder: false }))
          }
        }

        // Chunks the mover no longer sees: mutual visibility lost
        for (const chunkKey of result.exitedChunks) {
          for (const p of getPlayersInChunk(chunkKey)) {
            if (p.id === sessionId) continue
            sendTo(sessionId, net.createMessage('entity_despawn', { id: p.id }))
            sendTo(p.id, net.createMessage('entity_despawn', { id: sessionId }))
          }
        }
        return
      }
    },

    close(ws) {
      const { sessionId } = ws.getUserData()
      sockets.delete(sessionId)

      // Tell all players who could see the departing player before removing from registry
      for (const p of getAoIPlayers(sessionId)) {
        if (p.id === sessionId) continue
        sendTo(p.id, net.createMessage('entity_despawn', { id: sessionId }))
      }

      removePlayer(sessionId)
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
  }
}, TICK_MS)
