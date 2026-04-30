import { Container, Graphics, Text } from 'pixi.js'
import type { Application, Ticker } from 'pixi.js'
import { movement, resolveMovement, parseTileMap, PLAYER_BOUNDS } from '@isoland/shared'
import type { Vec2, TileMap, TileEffect } from '@isoland/shared'
import type { Scene } from './tilesScene.js'
import type { QualityReport } from '../quality/qualityTier.js'

const TILE_PX = 32

// Inline copy of packages/game-server/data/maps/test-map.json
const TEST_MAP_RAW = {
  width: 20,
  height: 20,
  tiles: [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0,
    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1,
    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
}

const TILE_FILL: Record<number, number> = {
  0: 0x3a5a2a, // floor
  1: 0x1a1a2a, // wall
  2: 0x1a4a99, // water
  3: 0xcc3300, // lava
}

const EFFECT_LABEL: Record<TileEffect, string> = {
  none: 'none',
  slow: 'slow  (water)',
  deadly: 'deadly  (lava)',
}

const EFFECT_COLOR: Record<TileEffect, string> = {
  none: '#88cc88',
  slow: '#5599ff',
  deadly: '#ff6633',
}

// Offline collision test — WASD movement against the test tile map, AABB visualised
export const createCollisionScene = (app: Application, _quality: QualityReport): Scene => {
  let root: Container | null = null
  let playerGfx: Graphics | null = null
  let posText: Text | null = null
  let effectText: Text | null = null
  let tileMap: TileMap | null = null

  let playerPos: Vec2 = { x: 2.5, y: 2.5 }
  let lastEffect: TileEffect = 'none'
  let seq = 0

  const heldKeys = new Set<string>()

  const mapOffset = () => ({
    ox: Math.round((app.screen.width - TEST_MAP_RAW.width * TILE_PX) / 2),
    oy: Math.round((app.screen.height - TEST_MAP_RAW.height * TILE_PX) / 2),
  })

  const updatePlayerGfx = () => {
    if (!playerGfx) return
    const { ox, oy } = mapOffset()
    const sx = ox + playerPos.x * TILE_PX
    const sy = oy + playerPos.y * TILE_PX
    const hw = PLAYER_BOUNDS.halfW * TILE_PX
    const hh = PLAYER_BOUNDS.halfH * TILE_PX

    playerGfx.clear()
    // AABB outline
    playerGfx
      .rect(sx - hw, sy - hh, hw * 2, hh * 2)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.6 })
    // Body dot
    playerGfx.circle(sx, sy, hw).fill(0xffdd00)
  }

  const updateHUD = () => {
    if (!posText || !effectText) return
    posText.text = `pos  ${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}`
    effectText.text = `effect  ${EFFECT_LABEL[lastEffect]}`
    effectText.style.fill = EFFECT_COLOR[lastEffect]
  }

  const tick = (ticker: Ticker) => {
    if (!tileMap) return

    let dx = 0
    let dy = 0
    if (heldKeys.has('w') || heldKeys.has('arrowup')) dy -= 1
    if (heldKeys.has('s') || heldKeys.has('arrowdown')) dy += 1
    if (heldKeys.has('a') || heldKeys.has('arrowleft')) dx -= 1
    if (heldKeys.has('d') || heldKeys.has('arrowright')) dx += 1

    if (dx !== 0 || dy !== 0) {
      const mag = Math.sqrt(dx * dx + dy * dy)
      const dir: Vec2 = { x: dx / mag, y: dy / mag }
      const input: movement.PlayerInput = {
        seq: ++seq,
        direction: dir,
        dt: ticker.deltaMS / 1000,
        timestamp: Date.now(),
      }
      const candidate = movement.applyInput(
        { position: playerPos, velocity: { x: 0, y: 0 } },
        input,
        TEST_MAP_RAW.width,
      )
      const resolved = resolveMovement(playerPos, candidate.position, PLAYER_BOUNDS, tileMap)
      playerPos = resolved.position
      lastEffect = resolved.effect
    }

    updatePlayerGfx()
    updateHUD()
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (!e.repeat) heldKeys.add(e.key.toLowerCase())
  }
  const onKeyup = (e: KeyboardEvent) => heldKeys.delete(e.key.toLowerCase())

  const start = () => {
    playerPos = { x: 2.5, y: 2.5 }
    lastEffect = 'none'
    seq = 0
    heldKeys.clear()
    tileMap = parseTileMap(TEST_MAP_RAW)

    root = new Container()
    const { ox, oy } = mapOffset()

    // Draw tilemap: filled tiles + grid lines
    const mapGfx = new Graphics()
    for (let ty = 0; ty < TEST_MAP_RAW.height; ty++) {
      for (let tx = 0; tx < TEST_MAP_RAW.width; tx++) {
        const id = TEST_MAP_RAW.tiles[ty * TEST_MAP_RAW.width + tx] ?? 0
        mapGfx
          .rect(ox + tx * TILE_PX, oy + ty * TILE_PX, TILE_PX, TILE_PX)
          .fill(TILE_FILL[id] ?? TILE_FILL[0])
      }
    }
    for (let i = 0; i <= TEST_MAP_RAW.width; i++) {
      mapGfx
        .moveTo(ox + i * TILE_PX, oy)
        .lineTo(ox + i * TILE_PX, oy + TEST_MAP_RAW.height * TILE_PX)
        .stroke({ color: 0x000000, width: 0.5, alpha: 0.25 })
    }
    for (let i = 0; i <= TEST_MAP_RAW.height; i++) {
      mapGfx
        .moveTo(ox, oy + i * TILE_PX)
        .lineTo(ox + TEST_MAP_RAW.width * TILE_PX, oy + i * TILE_PX)
        .stroke({ color: 0x000000, width: 0.5, alpha: 0.25 })
    }

    playerGfx = new Graphics()

    posText = new Text({
      text: '',
      style: { fill: '#cccccc', fontSize: 13, fontFamily: 'monospace' },
    })
    posText.x = 12
    posText.y = 12

    effectText = new Text({
      text: '',
      style: { fill: '#88cc88', fontSize: 13, fontFamily: 'monospace' },
    })
    effectText.x = 12
    effectText.y = 30

    const hintText = new Text({
      text: 'WASD / arrow keys to move',
      style: { fill: '#666666', fontSize: 12, fontFamily: 'monospace' },
    })
    hintText.x = 12
    hintText.y = app.screen.height - 48

    const legendText = new Text({
      text: 'floor   wall   water (slow)   lava (deadly)',
      style: { fill: '#888888', fontSize: 11, fontFamily: 'monospace' },
    })
    legendText.x = 12
    legendText.y = app.screen.height - 28

    root.addChild(mapGfx, playerGfx, posText, effectText, hintText, legendText)
    app.stage.addChild(root)

    updatePlayerGfx()
    updateHUD()

    app.ticker.add(tick)
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keyup', onKeyup)
  }

  const stop = () => {
    app.ticker.remove(tick)
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('keyup', onKeyup)
    heldKeys.clear()
    tileMap = null
    playerGfx = null
    posText = null
    effectText = null
    if (root) {
      app.stage.removeChild(root)
      root.destroy({ children: true })
      root = null
    }
  }

  return { start, stop }
}
