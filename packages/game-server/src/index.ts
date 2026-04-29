import uWS from 'uWebSockets.js'
import { net, grid } from '@isoland/shared'
import {
  addPlayer,
  removePlayer,
  getPlayer,
  getAoIPlayers,
  getPlayerIdsInChunk,
  getAllPlayers,
} from './world/state.js'
import { createSubscriptionManager } from './world/subscriptionManager.js'
import type { SubscriptionManager } from './world/subscriptionManager.js'
import { initBots, tickBots } from './world/botRunner.js'
import { createInputProcessor } from './player.js'
import type { InputProcessor } from './player.js'

const PORT = Number(process.env.PORT ?? 9001)
const TICK_RATE = 20
const TICK_MS = 1000 / TICK_RATE
const MAP_SIZE = Number(process.env.MAP_SIZE ?? 20)
const BOT_COUNT = Number(process.env.BOT_COUNT ?? 0)

type SocketData = { sessionId: string }

// Active connections: sessionId → WebSocket
const sockets = new Map<string, uWS.WebSocket<SocketData>>()
// Per-player subscription state
const subscriptions = new Map<string, SubscriptionManager>()
// Per-player input processor for client-side prediction
const inputProcessors = new Map<string, InputProcessor>()

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

// Notifies all player subscriptions when any entity (player or bot) crosses a chunk boundary
const notifyChunkChange = (entityId: string, prevChunkKey: string, nextChunkKey: string): void => {
  const entity = getPlayer(entityId)
  if (!entity) return
  const snapshot = toSnapshot(entity)
  for (const [pid, sub] of subscriptions) {
    if (pid === entityId) continue
    const { spawned: s, despawned: d } = sub.entityChunkChanged(
      entityId,
      prevChunkKey,
      nextChunkKey,
    )
    if (s.length > 0)
      sendTo(pid, net.createMessage('entity_spawn', { ...snapshot, placeholder: false }))
    if (d.length > 0) sendTo(pid, net.createMessage('entity_despawn', { id: entityId }))
  }
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

        const sub = createSubscriptionManager(sessionId, spawnPos.x, spawnPos.y)
        for (const p of getAoIPlayers(sessionId)) {
          if (p.id !== sessionId) {
            sub.entitySpawned(p.id, grid.tileChunkKey(p.position.x, p.position.y))
          }
        }
        subscriptions.set(sessionId, sub)
        inputProcessors.set(sessionId, createInputProcessor(sessionId))

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
              entities: getAoIPlayers(sessionId).map(toSnapshot),
              serverTime: Date.now(),
            }),
          ),
        )

        const spawnChunk = grid.tileChunkKey(spawnPos.x, spawnPos.y)
        const spawnSnapshot = toSnapshot({
          id: sessionId,
          name: msg.payload.characterId,
          position: spawnPos,
          velocity: { x: 0, y: 0 },
        })
        for (const [pid, otherSub] of subscriptions) {
          if (pid === sessionId) continue
          if (otherSub.entitySpawned(sessionId, spawnChunk)) {
            sendTo(pid, net.createMessage('entity_spawn', { ...spawnSnapshot, placeholder: false }))
          }
        }

        console.log(`[server] handshake  ${sessionId} @ ${spawnPos.x},${spawnPos.y}`)
        return
      }

      if (msg.type === net.MessageType.MOVE) {
        // Enqueue input; processed in the next server tick for authoritative reconciliation
        inputProcessors.get(sessionId)?.enqueue(msg.payload)
        return
      }
    },

    close(ws) {
      const { sessionId } = ws.getUserData()
      sockets.delete(sessionId)

      for (const [pid, sub] of subscriptions) {
        if (pid === sessionId) continue
        if (sub.entityDespawned(sessionId)) {
          sendTo(pid, net.createMessage('entity_despawn', { id: sessionId }))
        }
      }

      subscriptions.delete(sessionId)
      inputProcessors.delete(sessionId)
      removePlayer(sessionId)
      console.log(`[server] disconnected ${sessionId}`)
    },
  })
  .listen(PORT, (token) => {
    if (token) {
      const botLabel = BOT_COUNT > 0 ? `  bots=${BOT_COUNT}` : ''
      console.log(`[server] :${PORT} @ ${TICK_RATE}hz  map=${MAP_SIZE}x${MAP_SIZE}${botLabel}`)
    } else {
      console.error(`[server] failed to listen :${PORT}`)
    }
  })

if (BOT_COUNT > 0) initBots(BOT_COUNT, MAP_SIZE)

let tickCount = 0

setInterval(() => {
  tickCount++

  // Tick bots and propagate chunk-change notifications to player subscriptions
  for (const update of tickBots(MAP_SIZE)) {
    notifyChunkChange(update.id, update.prevChunkKey, update.nextChunkKey)
  }

  // Process queued player inputs and update subscriptions on chunk crossings
  for (const [sessionId] of sockets) {
    const proc = inputProcessors.get(sessionId)
    if (!proc) continue
    const result = proc.processAll(MAP_SIZE)
    if (!result || result.prevChunkKey === result.nextChunkKey) continue

    const moverSub = subscriptions.get(sessionId)
    if (moverSub) {
      const { spawned, despawned } = moverSub.playerMoved(
        result.newPos.x,
        result.newPos.y,
        getPlayerIdsInChunk,
      )
      for (const id of spawned) {
        const p = getPlayer(id)
        if (p)
          sendTo(
            sessionId,
            net.createMessage('entity_spawn', { ...toSnapshot(p), placeholder: false }),
          )
      }
      for (const id of despawned) {
        sendTo(sessionId, net.createMessage('entity_despawn', { id }))
      }
      notifyChunkChange(sessionId, result.prevChunkKey, result.nextChunkKey)
    }
  }

  const entityCount = getAllPlayers().length

  for (const [sessionId, ws] of sockets) {
    const sub = subscriptions.get(sessionId)
    const proc = inputProcessors.get(sessionId)
    if (!sub || !proc) continue

    const moves: net.WorldDeltaPayload['moves'] = []

    // Include the local player's authoritative state so the client can reconcile
    const self = getPlayer(sessionId)
    if (self) {
      moves.push({
        id: self.id,
        position: self.position,
        velocity: self.velocity,
        animState: 'idle',
      })
    }

    for (const entityId of sub.getSubscribed()) {
      const p = getPlayer(entityId)
      if (p) moves.push({ id: p.id, position: p.position, velocity: p.velocity, animState: 'idle' })
    }

    ws.send(
      net.serialize(
        net.createMessage('world_delta', {
          tick: tickCount,
          entityCount,
          lastProcessedSeq: proc.getLastProcessedSeq(),
          moves,
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
