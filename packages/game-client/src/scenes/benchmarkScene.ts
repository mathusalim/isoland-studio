import { Container, Graphics, Text, Ticker } from 'pixi.js'
import type { Application } from 'pixi.js'
import { net, grid } from '@isoland/shared'
import { createGameSocket } from '../net/gameSocket.js'
import { createPositionLerp } from '../net/interpolation.js'
import type { PositionLerp } from '../net/interpolation.js'
import type { Scene } from './tilesScene.js'
import type { QualityReport } from '../quality/qualityTier.js'

const SERVER_URL = 'ws://localhost:9001'
const AOI_RADIUS = 2

const LOCAL_COLOR = 0xffdd00
const SUBSCRIBED_COLOR = 0x00ddff
const GRID_COLOR = 0x1e2e3e
const CHUNK_COLOR = 0x2a3f52
const BG_COLOR = 0x111922
const AOI_FILL = 0x1a3a50

type EntityEntry = { lerp: PositionLerp; dot: Graphics; isLocal: boolean }

// AoI benchmark — connects to the server with BOT_COUNT/MAP_SIZE env vars and displays subscription stats
export const createBenchmarkScene = (app: Application, _quality: QualityReport): Scene => {
  let socket: ReturnType<typeof createGameSocket> | null = null
  let localId: string | null = null
  let localTile = { x: 0, y: 0 }
  let mapSize = 20
  let tilePx = 20
  let ox = 0
  let oy = 0
  let clockOffset = 0
  let lastMoveTs = 0
  let handshakeSentAt = 0
  let totalEntities = 0
  let msgsThisSec = 0
  let msgsPerSec = 0
  let bytesThisSec = 0
  let bytesPerSec = 0
  let lastStatFlush = Date.now()

  let root: Container | null = null
  let gridGfx: Graphics | null = null
  let entityLayer: Container | null = null
  let aoiOverlay: Graphics | null = null
  let statsLabel: Text | null = null
  const entities = new Map<string, EntityEntry>()

  const calcLayout = (ms: number) => {
    const screenMin = Math.min(app.screen.width, app.screen.height)
    tilePx = Math.max(2, Math.min(24, Math.floor((screenMin * 0.88) / ms)))
    const mapPx = ms * tilePx
    ox = Math.round((app.screen.width - mapPx) / 2)
    oy = Math.round((app.screen.height - mapPx) / 2)
  }

  const tileToScreen = (tx: number, ty: number) => ({
    sx: ox + tx * tilePx + tilePx / 2,
    sy: oy + ty * tilePx + tilePx / 2,
  })

  const drawAoIOverlay = () => {
    if (!aoiOverlay) return
    aoiOverlay.clear()
    const cx = grid.tileToChunk(localTile.x)
    const cy = grid.tileToChunk(localTile.y)
    const minTx = Math.max(0, grid.chunkTileMin(cx - AOI_RADIUS))
    const minTy = Math.max(0, grid.chunkTileMin(cy - AOI_RADIUS))
    const maxTx = Math.min(mapSize, grid.chunkTileMax(cx + AOI_RADIUS) + 1)
    const maxTy = Math.min(mapSize, grid.chunkTileMax(cy + AOI_RADIUS) + 1)
    aoiOverlay
      .rect(
        ox + minTx * tilePx,
        oy + minTy * tilePx,
        (maxTx - minTx) * tilePx,
        (maxTy - minTy) * tilePx,
      )
      .fill({ color: AOI_FILL, alpha: 0.35 })
      .stroke({ color: 0x3a7aaa, width: 1, alpha: 0.8 })
  }

  const updateStats = () => {
    if (!statsLabel) return
    const subscribed = [...entities.values()].filter((e) => !e.isLocal).length
    const efficiency =
      totalEntities > 1 ? Math.round((1 - subscribed / (totalEntities - 1)) * 100) : 0
    const cx = grid.tileToChunk(localTile.x)
    const cy = grid.tileToChunk(localTile.y)
    statsLabel.text = [
      `tile (${localTile.x},${localTile.y})  chunk ${cx},${cy}`,
      ``,
      `total in world:  ${totalEntities}`,
      `subscribed:      ${subscribed}`,
      `bandwidth saved: ${efficiency}%`,
      ``,
      `msgs/s:  ${msgsPerSec}`,
      `bytes/s: ${(bytesPerSec / 1024).toFixed(1)} KB`,
    ].join('\n')
  }

  const spawnEntity = (id: string, tx: number, ty: number, isLocal: boolean) => {
    if (entities.has(id) || !entityLayer) return
    const { sx, sy } = tileToScreen(tx, ty)
    const lerp = createPositionLerp(sx, sy)
    const r = Math.max(2, tilePx / 4)
    const dot = new Graphics().circle(0, 0, r).fill(isLocal ? LOCAL_COLOR : SUBSCRIBED_COLOR)
    dot.x = sx
    dot.y = sy
    entityLayer.addChild(dot)
    entities.set(id, { lerp, dot, isLocal })
  }

  const despawnEntity = (id: string) => {
    const e = entities.get(id)
    if (!e) return
    e.dot.destroy()
    entities.delete(id)
  }

  const tick = (ticker: Ticker) => {
    for (const entry of entities.values()) {
      entry.lerp.update(ticker.deltaMS)
      entry.dot.x = entry.lerp.x
      entry.dot.y = entry.lerp.y
    }

    const now = Date.now()
    if (now - lastStatFlush >= 1000) {
      msgsPerSec = msgsThisSec
      bytesPerSec = bytesThisSec
      msgsThisSec = 0
      bytesThisSec = 0
      lastStatFlush = now
      updateStats()
    }
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (!socket || !localId || e.repeat) return
    const now = Date.now()
    if (now - lastMoveTs < 100) return
    lastMoveTs = now
    const dirs: Record<string, { dx: number; dy: number }> = {
      w: { dx: 0, dy: -1 },
      arrowup: { dx: 0, dy: -1 },
      s: { dx: 0, dy: 1 },
      arrowdown: { dx: 0, dy: 1 },
      a: { dx: -1, dy: 0 },
      arrowleft: { dx: -1, dy: 0 },
      d: { dx: 1, dy: 0 },
      arrowright: { dx: 1, dy: 0 },
    }
    const d = dirs[e.key.toLowerCase()]
    if (!d) return
    const nx = Math.max(0, Math.min(mapSize - 1, localTile.x + d.dx))
    const ny = Math.max(0, Math.min(mapSize - 1, localTile.y + d.dy))
    if (nx === localTile.x && ny === localTile.y) return
    localTile = { x: nx, y: ny }
    const { sx, sy } = tileToScreen(nx, ny)
    entities.get(localId)?.lerp.setTarget(sx, sy)
    drawAoIOverlay()
    updateStats()
    socket.send(
      net.createMessage('move', {
        destination: { x: nx, y: ny },
        inputTs: Date.now() + clockOffset,
      }),
    )
  }

  const buildGrid = (gridGfx: Graphics) => {
    const mapPx = mapSize * tilePx
    gridGfx.rect(ox, oy, mapPx, mapPx).fill(BG_COLOR)
    for (let i = 0; i <= mapSize; i++) {
      const isBoundary = i % grid.CHUNK_SIZE === 0
      const color = isBoundary ? CHUNK_COLOR : GRID_COLOR
      const width = isBoundary ? 1 : 0.5
      gridGfx
        .moveTo(ox + i * tilePx, oy)
        .lineTo(ox + i * tilePx, oy + mapPx)
        .stroke({ color, width })
      gridGfx
        .moveTo(ox, oy + i * tilePx)
        .lineTo(ox + mapPx, oy + i * tilePx)
        .stroke({ color, width })
    }
  }

  const start = () => {
    localId = null
    localTile = { x: 0, y: 0 }
    mapSize = 20
    totalEntities = 0
    msgsThisSec = 0
    bytesThisSec = 0
    clockOffset = 0
    lastMoveTs = 0
    lastStatFlush = Date.now()

    calcLayout(mapSize)

    root = new Container()
    gridGfx = new Graphics()
    entityLayer = new Container()
    aoiOverlay = new Graphics()

    buildGrid(gridGfx)

    statsLabel = new Text({
      text: 'connecting…',
      style: { fill: 0x88aacc, fontSize: 12, fontFamily: 'monospace', lineHeight: 18 },
    })
    statsLabel.x = 12
    statsLabel.y = 12

    const hintLabel = new Text({
      text: 'WASD / arrows to move   blue = subscribed   yellow = you',
      style: { fill: 0x556677, fontSize: 11, fontFamily: 'monospace' },
    })
    hintLabel.x = 12
    hintLabel.y = app.screen.height - 24

    root.addChild(gridGfx, aoiOverlay, entityLayer, statsLabel, hintLabel)
    app.stage.addChild(root)

    socket = createGameSocket(SERVER_URL)

    socket.on('handshake_ack', (msg) => {
      localId = msg.payload.sessionId
      clockOffset = net.computeClockOffset(handshakeSentAt, msg.payload.serverTime, Date.now())
    })

    socket.on('world_init', (msg) => {
      mapSize = msg.payload.tilemap.columns
      calcLayout(mapSize)
      if (gridGfx) {
        gridGfx.clear()
        buildGrid(gridGfx)
      }

      for (const e of msg.payload.entities) {
        spawnEntity(e.id, e.position.x, e.position.y, e.id === localId)
        if (e.id === localId) localTile = { ...e.position }
      }
      drawAoIOverlay()
      updateStats()
    })

    socket.on('entity_spawn', (msg) => {
      const e = msg.payload
      spawnEntity(e.id, e.position.x, e.position.y, e.id === localId)
      msgsThisSec++
      bytesThisSec += net.serialize(msg).length
      updateStats()
    })

    socket.on('entity_despawn', (msg) => {
      despawnEntity(msg.payload.id)
      msgsThisSec++
      bytesThisSec += net.serialize(msg).length
      updateStats()
    })

    socket.on('world_delta', (msg) => {
      totalEntities = msg.payload.entityCount
      msgsThisSec++
      bytesThisSec += net.serialize(msg).length

      for (const move of msg.payload.moves) {
        const entry = entities.get(move.id)
        if (!entry || entry.isLocal) continue
        const { sx, sy } = tileToScreen(move.position.x, move.position.y)
        entry.lerp.setTarget(sx, sy)
      }
    })

    const tryHandshake = () => {
      if (!socket) return
      if (socket.connected) {
        handshakeSentAt = Date.now()
        socket.send(
          net.createMessage('handshake', {
            clientVersion: '0.1.0',
            authToken: 'dev',
            characterId: `bench-${Math.random().toString(36).slice(2, 6)}`,
          }),
        )
      } else {
        setTimeout(tryHandshake, 50)
      }
    }
    tryHandshake()

    app.ticker.add(tick)
    window.addEventListener('keydown', onKeydown)
  }

  const stop = () => {
    app.ticker.remove(tick)
    window.removeEventListener('keydown', onKeydown)
    socket?.close()
    socket = null
    for (const entry of entities.values()) entry.dot.destroy()
    entities.clear()
    if (root) {
      app.stage.removeChild(root)
      root.destroy({ children: true })
      root = null
      gridGfx = null
      entityLayer = null
      aoiOverlay = null
      statsLabel = null
    }
  }

  return { start, stop }
}
