import { Graphics, Text, Ticker } from 'pixi.js'
import type { Application } from 'pixi.js'
import { net } from '@isoland/shared'
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
const BG_COLOR = 0x1a2a3a

// Tile coords → pixel center on screen
const tileToScreen = (tx: number, ty: number, offsetX: number, offsetY: number) => ({
  sx: offsetX + tx * TILE_PX + TILE_PX / 2,
  sy: offsetY + ty * TILE_PX + TILE_PX / 2,
})

type PlayerEntry = {
  lerp: PositionLerp
  sprite: Graphics
  label: Text
  isLocal: boolean
}

// Multiplayer position broadcast proof-of-concept — WASD to move, see others move in real time
export const createMultiScene = (app: Application, _quality: QualityReport): Scene => {
  let socket: ReturnType<typeof createGameSocket> | null = null
  let localId: string | null = null
  let localTile = { x: 5, y: 5 }
  let clockOffset = 0
  let lastMoveTs = 0

  const offsets = () => ({
    ox: Math.round((app.screen.width - MAP_PX) / 2),
    oy: Math.round((app.screen.height - MAP_PX) / 2),
  })

  // ── containers ──────────────────────────────────────────────────────────
  const root = new Graphics()
  const gridGfx = new Graphics()
  const entityLayer = new Graphics()
  const players = new Map<string, PlayerEntry>()
  let statusLabel: Text | null = null
  let hintLabel: Text | null = null

  root.addChild(gridGfx)
  root.addChild(entityLayer)

  const drawGrid = () => {
    const { ox, oy } = offsets()
    gridGfx.clear()
    gridGfx.rect(ox, oy, MAP_PX, MAP_PX).fill(BG_COLOR)
    for (let i = 0; i <= MAP_SIZE; i++) {
      gridGfx
        .moveTo(ox + i * TILE_PX, oy)
        .lineTo(ox + i * TILE_PX, oy + MAP_PX)
        .stroke({ color: GRID_COLOR, width: 1 })
      gridGfx
        .moveTo(ox, oy + i * TILE_PX)
        .lineTo(ox + MAP_PX, oy + i * TILE_PX)
        .stroke({ color: GRID_COLOR, width: 1 })
    }
  }

  const spawnPlayer = (id: string, tx: number, ty: number, isLocal: boolean) => {
    if (players.has(id)) return
    const { ox, oy } = offsets()
    const { sx, sy } = tileToScreen(tx, ty, ox, oy)
    const lerp = createPositionLerp(sx, sy)

    const sprite = new Graphics()
    sprite.circle(0, 0, 10).fill(isLocal ? LOCAL_COLOR : REMOTE_COLOR)
    sprite.x = sx
    sprite.y = sy

    const label = new Text({
      text: isLocal ? 'YOU' : id.slice(0, 6),
      style: { fill: 0xffffff, fontSize: 9, fontFamily: 'monospace' },
    })
    label.anchor.set(0.5, 1.4)
    label.x = sx
    label.y = sy

    entityLayer.addChild(sprite)
    entityLayer.addChild(label)
    players.set(id, { lerp, sprite, label, isLocal })
  }

  const despawnPlayer = (id: string) => {
    const e = players.get(id)
    if (!e) return
    e.sprite.destroy()
    e.label.destroy()
    players.delete(id)
  }

  // ── tick ────────────────────────────────────────────────────────────────
  const tick = (ticker: Ticker) => {
    const { ox, oy } = offsets()
    for (const entry of players.values()) {
      entry.lerp.update(ticker.deltaMS)
      entry.sprite.x = entry.lerp.x
      entry.sprite.y = entry.lerp.y
      entry.label.x = entry.lerp.x
      entry.label.y = entry.lerp.y
    }
    void ox
    void oy
  }

  // ── WASD ─────────────────────────────────────────────────────────────────
  const onKeydown = (e: KeyboardEvent) => {
    if (!socket || !localId || e.repeat) return
    const now = Date.now()
    if (now - lastMoveTs < 100) return // max 10 moves/sec
    lastMoveTs = now

    const delta: Record<string, { dx: number; dy: number }> = {
      w: { dx: 0, dy: -1 },
      arrowup: { dx: 0, dy: -1 },
      s: { dx: 0, dy: 1 },
      arrowdown: { dx: 0, dy: 1 },
      a: { dx: -1, dy: 0 },
      arrowleft: { dx: -1, dy: 0 },
      d: { dx: 1, dy: 0 },
      arrowright: { dx: 1, dy: 0 },
    }
    const d = delta[e.key.toLowerCase()]
    if (!d) return

    const nx = Math.max(0, Math.min(MAP_SIZE - 1, localTile.x + d.dx))
    const ny = Math.max(0, Math.min(MAP_SIZE - 1, localTile.y + d.dy))
    if (nx === localTile.x && ny === localTile.y) return
    localTile = { x: nx, y: ny }

    // Predict immediately — lerp target moves without waiting for server
    const { ox, oy } = offsets()
    const { sx, sy } = tileToScreen(nx, ny, ox, oy)
    players.get(localId)?.lerp.setTarget(sx, sy)

    socket.send(
      net.createMessage('move', {
        destination: { x: nx, y: ny },
        inputTs: Date.now() + clockOffset,
      }),
    )
  }

  // ── start / stop ─────────────────────────────────────────────────────────
  const start = () => {
    app.stage.addChild(root)
    drawGrid()

    statusLabel = new Text({
      text: 'connecting…',
      style: { fill: 0xaaaaaa, fontSize: 14, fontFamily: 'monospace' },
    })
    statusLabel.x = 12
    statusLabel.y = 12
    root.addChild(statusLabel)

    hintLabel = new Text({
      text: 'WASD / arrow keys to move',
      style: { fill: 0x888888, fontSize: 12, fontFamily: 'monospace' },
    })
    hintLabel.x = 12
    hintLabel.y = app.screen.height - 28
    root.addChild(hintLabel)

    socket = createGameSocket(SERVER_URL)

    socket.on('handshake_ack', (msg) => {
      localId = msg.payload.sessionId
      clockOffset = net.computeClockOffset(0, msg.payload.serverTime, Date.now())
      if (statusLabel) statusLabel.text = `connected  id=${localId.slice(0, 8)}`
      socket!.send(net.createMessage('ping', { clientTs: Date.now() }))
    })

    socket.on('world_init', (msg) => {
      for (const e of msg.payload.entities) {
        spawnPlayer(e.id, e.position.x, e.position.y, e.id === localId)
        if (e.id === localId) localTile = { x: e.position.x, y: e.position.y }
      }
    })

    socket.on('entity_spawn', (msg) => {
      const e = msg.payload
      spawnPlayer(e.id, e.position.x, e.position.y, e.id === localId)
    })

    socket.on('entity_despawn', (msg) => {
      despawnPlayer(msg.payload.id)
    })

    socket.on('world_delta', (msg) => {
      const { ox, oy } = offsets()
      for (const move of msg.payload.moves) {
        const entry = players.get(move.id)
        if (!entry) continue
        // Remote players track server authority; local player already predicted
        if (!entry.isLocal) {
          const { sx, sy } = tileToScreen(move.position.x, move.position.y, ox, oy)
          entry.lerp.setTarget(sx, sy)
        }
      }
    })

    // Send handshake once the connection opens
    const tryHandshake = () => {
      if (socket?.connected) {
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
    localId = null
    for (const entry of players.values()) {
      entry.sprite.destroy()
      entry.label.destroy()
    }
    players.clear()
    statusLabel?.destroy()
    statusLabel = null
    hintLabel?.destroy()
    hintLabel = null
    root.destroy({ children: true })
    app.stage.removeChild(root)
  }

  return { start, stop }
}
