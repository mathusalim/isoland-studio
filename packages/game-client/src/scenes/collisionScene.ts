import { Container, Graphics, Text } from 'pixi.js'
import { FONT_DISPLAY } from '../theme.js'
import type { Application, Ticker } from 'pixi.js'
import {
  movement,
  resolveMovement,
  parseTileMap,
  PLAYER_BOUNDS,
  canDodge,
  startDodge,
  tickDodge,
  isDodgeActive,
  isInvincible,
  getDodgeSpeedMultiplier,
  dodgeCooldownRemaining,
  defaultPlayerState,
  DODGE_SPEED_MULTIPLIER,
} from '@isoland/shared'
import type { Vec2, TileMap, TileEffect, PlayerState } from '@isoland/shared'
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
  0: 0x3a5a2a,
  1: 0x1a1a2a,
  2: 0x1a4a99,
  3: 0xcc3300,
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

// Offline collision + dodge test — WASD to move, Space to dodge, AABB + iframe flash visualised
export const createCollisionScene = (app: Application, _quality: QualityReport): Scene => {
  let root: Container | null = null
  let playerGfx: Graphics | null = null
  let posText: Text | null = null
  let effectText: Text | null = null
  let dodgeText: Text | null = null
  let tileMap: TileMap | null = null

  let playerPos: Vec2 = { x: 2.5, y: 2.5 }
  let playerState: PlayerState = defaultPlayerState()
  let lastEffect: TileEffect = 'none'
  let seq = 0

  const heldKeys = new Set<string>()
  let dodgePressed = false

  const mapOffset = () => ({
    ox: Math.round((app.screen.width - TEST_MAP_RAW.width * TILE_PX) / 2),
    oy: Math.round((app.screen.height - TEST_MAP_RAW.height * TILE_PX) / 2),
  })

  const updatePlayerGfx = (now: number) => {
    if (!playerGfx) return
    const { ox, oy } = mapOffset()
    const sx = ox + playerPos.x * TILE_PX
    const sy = oy + playerPos.y * TILE_PX
    const hw = PLAYER_BOUNDS.halfW * TILE_PX
    const hh = PLAYER_BOUNDS.halfH * TILE_PX

    const dodging = isDodgeActive(playerState, now)
    const invincible = isInvincible(playerState, now)

    // Squash scale: compress to 0.7 over first 150ms, restore over last 150ms
    let scaleX = 1
    let scaleY = 1
    if (dodging) {
      const elapsed = now - playerState.dodge.startTime
      const half = 150
      const t = elapsed < half ? elapsed / half : 1 - (elapsed - half) / half
      scaleX = 1 - 0.3 * Math.max(0, Math.min(1, t))
      scaleY = 1 + 0.15 * Math.max(0, Math.min(1, t))
    }

    // Iframe tint: blue-white flash during invincibility window
    const bodyColor = invincible ? 0xccccff : 0xffdd00
    const aabbAlpha = invincible ? 0.9 : 0.6

    playerGfx.clear()
    playerGfx
      .rect(sx - hw, sy - hh, hw * 2, hh * 2)
      .stroke({ color: invincible ? 0xaaaaff : 0xffffff, width: 1, alpha: aabbAlpha })
    playerGfx.circle(sx, sy, hw * scaleX).fill(bodyColor)
    playerGfx.scale.y = scaleY
  }

  const updateHUD = (now: number) => {
    if (!posText || !effectText || !dodgeText) return
    posText.text = `pos  ${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}`
    effectText.text = `effect  ${EFFECT_LABEL[lastEffect]}`
    effectText.style.fill = EFFECT_COLOR[lastEffect]

    const dodging = isDodgeActive(playerState, now)
    const cooldown = dodgeCooldownRemaining(playerState, now)
    if (dodging) {
      dodgeText.text = `dodge  rolling`
      dodgeText.style.fill = '#aaaaff'
    } else if (cooldown < 1) {
      dodgeText.text = `dodge  cooldown  ${Math.round((1 - cooldown) * 100)}%`
      dodgeText.style.fill = '#888888'
    } else {
      dodgeText.text = `dodge  ready  [Space]`
      dodgeText.style.fill = '#cccccc'
    }
  }

  const tick = (ticker: Ticker) => {
    if (!tileMap) return

    const now = Date.now()

    playerState = tickDodge(playerState, now)

    let dx = 0
    let dy = 0
    if (heldKeys.has('w') || heldKeys.has('arrowup')) dy -= 1
    if (heldKeys.has('s') || heldKeys.has('arrowdown')) dy += 1
    if (heldKeys.has('a') || heldKeys.has('arrowleft')) dx -= 1
    if (heldKeys.has('d') || heldKeys.has('arrowright')) dx += 1

    const thisDodge = dodgePressed
    dodgePressed = false

    if (dx !== 0 || dy !== 0 || thisDodge) {
      const mag = dx !== 0 || dy !== 0 ? Math.sqrt(dx * dx + dy * dy) : 1
      const dir: Vec2 = dx !== 0 || dy !== 0 ? { x: dx / mag, y: dy / mag } : { x: 0, y: 0 }

      const input: movement.PlayerInput = {
        seq: ++seq,
        direction: dir,
        dt: ticker.deltaMS / 1000,
        timestamp: now,
        dodge: thisDodge,
      }

      if (thisDodge && canDodge(playerState, now)) {
        playerState = startDodge(playerState, input, now)
      }

      const dodging = isDodgeActive(playerState, now)
      const effectiveDir = dodging ? playerState.dodge.direction : dir
      const speedMult = dodging ? DODGE_SPEED_MULTIPLIER : getDodgeSpeedMultiplier(playerState)
      const effectiveInput = { ...input, direction: effectiveDir }

      const candidate = movement.applyInput(
        { position: playerPos, velocity: { x: 0, y: 0 } },
        effectiveInput,
        TEST_MAP_RAW.width,
        speedMult,
      )
      const resolved = resolveMovement(playerPos, candidate.position, PLAYER_BOUNDS, tileMap)
      playerPos = resolved.position
      lastEffect = resolved.effect

      if (effectiveDir.x !== 0 || effectiveDir.y !== 0) {
        playerState = { ...playerState, lastMoveDir: effectiveDir }
      }
    }

    updatePlayerGfx(now)
    updateHUD(now)
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (!e.repeat) {
      heldKeys.add(e.key.toLowerCase())
      if (e.key === ' ') dodgePressed = true
    }
  }
  const onKeyup = (e: KeyboardEvent) => heldKeys.delete(e.key.toLowerCase())

  const start = () => {
    playerPos = { x: 2.5, y: 2.5 }
    playerState = defaultPlayerState()
    lastEffect = 'none'
    seq = 0
    dodgePressed = false
    heldKeys.clear()
    tileMap = parseTileMap(TEST_MAP_RAW)

    root = new Container()
    const { ox, oy } = mapOffset()

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
      style: { fill: '#cccccc', fontSize: 13, fontFamily: FONT_DISPLAY },
    })
    posText.x = 12
    posText.y = 12

    effectText = new Text({
      text: '',
      style: { fill: '#88cc88', fontSize: 13, fontFamily: FONT_DISPLAY },
    })
    effectText.x = 12
    effectText.y = 30

    dodgeText = new Text({
      text: '',
      style: { fill: '#cccccc', fontSize: 13, fontFamily: FONT_DISPLAY },
    })
    dodgeText.x = 12
    dodgeText.y = 48

    const hintText = new Text({
      text: 'WASD / arrows to move   Space to dodge',
      style: { fill: '#666666', fontSize: 12, fontFamily: FONT_DISPLAY },
    })
    hintText.x = 12
    hintText.y = app.screen.height - 28

    root.addChild(mapGfx, playerGfx, posText, effectText, dodgeText, hintText)
    app.stage.addChild(root)

    const now = Date.now()
    updatePlayerGfx(now)
    updateHUD(now)

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
    dodgeText = null
    if (root) {
      app.stage.removeChild(root)
      root.destroy({ children: true })
      root = null
    }
  }

  return { start, stop }
}
