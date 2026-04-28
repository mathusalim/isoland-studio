import { Container, Graphics, Text, Ticker } from 'pixi.js'
import type { Application } from 'pixi.js'
import { net, grid } from '@isoland/shared'
import { createGameSocket } from '../net/gameSocket.js'
import { createPositionLerp } from '../net/interpolation.js'
import type { PositionLerp } from '../net/interpolation.js'
import type { Scene } from './tilesScene.js'
import type { QualityReport } from '../quality/qualityTier.js'

const SERVER_URL = 'ws://localhost:9001'
const MAP_SIZE = 20
const TILE_PX = 32
const MAP_PX = MAP_SIZE * TILE_PX

const LOCAL_COLOR = 0xffdd00
const REMOTE_COLOR = 0x00ddff
const GRID_COLOR = 0x334455
const CHUNK_COLOR = 0x556677
const BG_COLOR = 0x1a2a3a

const DISPLAY_AOI_RADIUS = 2

const tileToScreen = (tx: number, ty: number, ox: number, oy: number) => ({
  sx: ox + tx * TILE_PX + TILE_PX / 2,
  sy: oy + ty * TILE_PX + TILE_PX / 2,
})

const mapOffset = (app: Application) => ({
  ox: Math.round((app.screen.width - MAP_PX) / 2),
  oy: Math.round((app.screen.height - MAP_PX) / 2),
})

type PlayerEntry = { lerp: PositionLerp; sprite: Graphics; label: Text; isLocal: boolean }

// Multiplayer proof-of-concept — WASD to move, see other tabs' players in real time
export const createMultiScene = (app: Application, _quality: QualityReport): Scene => {
  let socket: ReturnType<typeof createGameSocket> | null = null
  let localId: string | null = null
  let localTile = { x: 5, y: 5 }
  let clockOffset = 0
  let lastMoveTs = 0
  let handshakeSentAt = 0

  // All display objects are created in start() and destroyed in stop()
  let root: Container | null = null
  let entityLayer: Container | null = null
  let statusLabel: Text | null = null
  let posLabel: Text | null = null
  const players = new Map<string, PlayerEntry>()

  const updatePosLabel = () => {
    if (!posLabel) return
    const cx = grid.tileToChunk(localTile.x)
    const cy = grid.tileToChunk(localTile.y)
    const aoi = grid.aoiChunkKeys(localTile.x, localTile.y, DISPLAY_AOI_RADIUS)
    const remoteCount = [...players.values()].filter((p) => !p.isLocal).length
    posLabel.text = `tile (${localTile.x}, ${localTile.y})   chunk ${cx},${cy}   aoi ${aoi.size}   visible ${remoteCount}`
  }

  const spawnPlayer = (id: string, tx: number, ty: number, isLocal: boolean) => {
    if (players.has(id) || !entityLayer) return
    const { ox, oy } = mapOffset(app)
    const { sx, sy } = tileToScreen(tx, ty, ox, oy)
    const lerp = createPositionLerp(sx, sy)

    const sprite = new Graphics().circle(0, 0, 10).fill(isLocal ? LOCAL_COLOR : REMOTE_COLOR)
    sprite.x = sx
    sprite.y = sy

    const label = new Text({
      text: isLocal ? 'YOU' : id.slice(0, 6),
      style: { fill: 0xffffff, fontSize: 9, fontFamily: 'monospace' },
    })
    label.anchor.set(0.5, 1.4)
    label.x = sx
    label.y = sy

    entityLayer.addChild(sprite, label)
    players.set(id, { lerp, sprite, label, isLocal })
  }

  const despawnPlayer = (id: string) => {
    const e = players.get(id)
    if (!e) return
    e.sprite.destroy()
    e.label.destroy()
    players.delete(id)
  }

  const tick = (ticker: Ticker) => {
    for (const entry of players.values()) {
      entry.lerp.update(ticker.deltaMS)
      entry.sprite.x = entry.lerp.x
      entry.sprite.y = entry.lerp.y
      entry.label.x = entry.lerp.x
      entry.label.y = entry.lerp.y
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

    const nx = Math.max(0, Math.min(MAP_SIZE - 1, localTile.x + d.dx))
    const ny = Math.max(0, Math.min(MAP_SIZE - 1, localTile.y + d.dy))
    if (nx === localTile.x && ny === localTile.y) return
    localTile = { x: nx, y: ny }
    updatePosLabel()

    const { ox, oy } = mapOffset(app)
    const { sx, sy } = tileToScreen(nx, ny, ox, oy)
    players.get(localId)?.lerp.setTarget(sx, sy)

    socket.send(
      net.createMessage('move', {
        destination: { x: nx, y: ny },
        inputTs: Date.now() + clockOffset,
      }),
    )
  }

  const start = () => {
    localId = null
    localTile = { x: 5, y: 5 }
    clockOffset = 0
    lastMoveTs = 0

    // Build display tree fresh each start
    root = new Container()
    entityLayer = new Container()

    const { ox, oy } = mapOffset(app)
    const gridGfx = new Graphics()
    gridGfx.rect(ox, oy, MAP_PX, MAP_PX).fill(BG_COLOR)
    for (let i = 0; i <= MAP_SIZE; i++) {
      const isChunkBoundary = i % grid.CHUNK_SIZE === 0
      const color = isChunkBoundary ? CHUNK_COLOR : GRID_COLOR
      const width = isChunkBoundary ? 1.5 : 1
      gridGfx
        .moveTo(ox + i * TILE_PX, oy)
        .lineTo(ox + i * TILE_PX, oy + MAP_PX)
        .stroke({ color, width })
      gridGfx
        .moveTo(ox, oy + i * TILE_PX)
        .lineTo(ox + MAP_PX, oy + i * TILE_PX)
        .stroke({ color, width })
    }

    statusLabel = new Text({
      text: 'connecting…',
      style: { fill: 0xaaaaaa, fontSize: 14, fontFamily: 'monospace' },
    })
    statusLabel.x = 12
    statusLabel.y = 12

    posLabel = new Text({
      text: '',
      style: { fill: 0x7799aa, fontSize: 12, fontFamily: 'monospace' },
    })
    posLabel.x = 12
    posLabel.y = 32

    const hintLabel = new Text({
      text: 'WASD / arrow keys to move',
      style: { fill: 0x888888, fontSize: 12, fontFamily: 'monospace' },
    })
    hintLabel.x = 12
    hintLabel.y = app.screen.height - 28

    root.addChild(gridGfx, entityLayer, statusLabel, posLabel, hintLabel)
    app.stage.addChild(root)

    socket = createGameSocket(SERVER_URL)

    socket.on('handshake_ack', (msg) => {
      localId = msg.payload.sessionId
      clockOffset = net.computeClockOffset(handshakeSentAt, msg.payload.serverTime, Date.now())
      if (statusLabel) statusLabel.text = `connected  id=${localId.slice(0, 8)}`
    })

    socket.on('world_init', (msg) => {
      for (const e of msg.payload.entities) {
        spawnPlayer(e.id, e.position.x, e.position.y, e.id === localId)
        if (e.id === localId) localTile = { ...e.position }
      }
      updatePosLabel()
    })

    socket.on('entity_spawn', (msg) => {
      const e = msg.payload
      spawnPlayer(e.id, e.position.x, e.position.y, e.id === localId)
      updatePosLabel()
    })

    socket.on('entity_despawn', (msg) => {
      despawnPlayer(msg.payload.id)
      updatePosLabel()
    })

    socket.on('world_delta', (msg) => {
      const { ox, oy } = mapOffset(app)
      for (const move of msg.payload.moves) {
        const entry = players.get(move.id)
        if (!entry || entry.isLocal) continue
        const { sx, sy } = tileToScreen(move.position.x, move.position.y, ox, oy)
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
            characterId: `player-${Math.random().toString(36).slice(2, 6)}`,
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
    for (const entry of players.values()) {
      entry.sprite.destroy()
      entry.label.destroy()
    }
    players.clear()
    if (root) {
      app.stage.removeChild(root)
      root.destroy({ children: true })
      root = null
      entityLayer = null
      statusLabel = null
      posLabel = null
    }
  }

  return { start, stop }
}
