import { Container, Graphics, Text, Ticker } from 'pixi.js'
import type { Application } from 'pixi.js'
import { net, grid, movement } from '@isoland/shared'
import { createGameSocket } from '../net/gameSocket.js'
import { createPositionLerp } from '../net/interpolation.js'
import type { PositionLerp } from '../net/interpolation.js'
import { createPredictionBuffer } from '../prediction.js'
import type { PredictionBuffer } from '../prediction.js'
import type { Scene } from './tilesScene.js'
import type { QualityReport } from '../quality/qualityTier.js'

const SERVER_URL = 'ws://localhost:9001'
const TILE_PX = 32

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

const mapOffset = (app: Application, mapSize: number) => ({
  ox: Math.round((app.screen.width - mapSize * TILE_PX) / 2),
  oy: Math.round((app.screen.height - mapSize * TILE_PX) / 2),
})

type PlayerEntry = { lerp: PositionLerp; sprite: Graphics; label: Text; isLocal: boolean }

// Multiplayer proof-of-concept — WASD to move, see other tabs' players in real time
export const createMultiScene = (app: Application, _quality: QualityReport): Scene => {
  let socket: ReturnType<typeof createGameSocket> | null = null
  let localId: string | null = null
  let localTile = { x: 5, y: 5 }
  let mapSize = 20
  let clockOffset = 0
  let handshakeSentAt = 0
  let inputSeq = 0
  let predBuf: PredictionBuffer | null = null

  const heldKeys = new Set<string>()

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
    const { ox, oy } = mapOffset(app, mapSize)
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
    // Sample held keys and emit a movement input each frame
    if (socket && localId && predBuf) {
      let dx = 0
      let dy = 0
      if (heldKeys.has('w') || heldKeys.has('arrowup')) dy -= 1
      if (heldKeys.has('s') || heldKeys.has('arrowdown')) dy += 1
      if (heldKeys.has('a') || heldKeys.has('arrowleft')) dx -= 1
      if (heldKeys.has('d') || heldKeys.has('arrowright')) dx += 1

      if (dx !== 0 || dy !== 0) {
        const input: movement.PlayerInput = {
          seq: ++inputSeq,
          direction: { x: dx, y: dy },
          dt: ticker.deltaMS / 1000,
          timestamp: Date.now(),
        }
        predBuf.add(input, mapSize)
        socket.send(net.createMessage('move', input))
        const pos = predBuf.getState().position
        localTile = { x: Math.round(pos.x), y: Math.round(pos.y) }
        updatePosLabel()
      }
    }

    const { ox, oy } = mapOffset(app, mapSize)

    for (const [id, entry] of players) {
      if (entry.isLocal && predBuf) {
        // Local player is driven by the prediction buffer, not lerp
        const pos = predBuf.getState().position
        entry.sprite.x = ox + pos.x * TILE_PX + TILE_PX / 2
        entry.sprite.y = oy + pos.y * TILE_PX + TILE_PX / 2
      } else {
        entry.lerp.update(ticker.deltaMS)
        entry.sprite.x = entry.lerp.x
        entry.sprite.y = entry.lerp.y
      }
      entry.label.x = entry.sprite.x
      entry.label.y = entry.sprite.y
    }
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (!e.repeat) heldKeys.add(e.key.toLowerCase())
  }

  const onKeyup = (e: KeyboardEvent) => {
    heldKeys.delete(e.key.toLowerCase())
  }

  const start = () => {
    localId = null
    localTile = { x: 5, y: 5 }
    mapSize = 20
    clockOffset = 0
    inputSeq = 0
    predBuf = null
    heldKeys.clear()

    root = new Container()
    entityLayer = new Container()

    const { ox, oy } = mapOffset(app, mapSize)
    const mapPx = mapSize * TILE_PX
    const gridGfx = new Graphics()
    gridGfx.rect(ox, oy, mapPx, mapPx).fill(BG_COLOR)
    for (let i = 0; i <= mapSize; i++) {
      const isChunkBoundary = i % grid.CHUNK_SIZE === 0
      const color = isChunkBoundary ? CHUNK_COLOR : GRID_COLOR
      const width = isChunkBoundary ? 1.5 : 1
      gridGfx
        .moveTo(ox + i * TILE_PX, oy)
        .lineTo(ox + i * TILE_PX, oy + mapPx)
        .stroke({ color, width })
      gridGfx
        .moveTo(ox, oy + i * TILE_PX)
        .lineTo(ox + mapPx, oy + i * TILE_PX)
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
      mapSize = msg.payload.tilemap.columns
      for (const e of msg.payload.entities) {
        if (e.id === localId) {
          predBuf = createPredictionBuffer({ ...e.position })
          localTile = { ...e.position }
        }
        spawnPlayer(e.id, e.position.x, e.position.y, e.id === localId)
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
      const { ox, oy } = mapOffset(app, mapSize)
      for (const move of msg.payload.moves) {
        if (move.id === localId && predBuf) {
          // Reconcile: reset to server authority and re-apply any unacked inputs
          predBuf.reconcile(
            {
              lastProcessedSeq: msg.payload.lastProcessedSeq,
              position: move.position,
              velocity: move.velocity,
            },
            mapSize,
          )
          const pos = predBuf.getState().position
          localTile = { x: Math.round(pos.x), y: Math.round(pos.y) }
          updatePosLabel()
          continue
        }
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
    window.addEventListener('keyup', onKeyup)
  }

  const stop = () => {
    app.ticker.remove(tick)
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('keyup', onKeyup)
    socket?.close()
    socket = null
    predBuf = null
    heldKeys.clear()
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
