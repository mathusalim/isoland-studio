import { Graphics } from 'pixi.js'
import type { Application, Ticker } from 'pixi.js'
import { utils } from '@isoland/shared'
import { buildTileTextures } from './tilemap/tileTextures.js'
import { createTilemapRenderer } from './tilemap/TilemapRenderer.js'
import { createCamera } from './camera/camera.js'
import type { Camera } from './camera/camera.js'

const MAP_SIZE = 20
const TILE_WIDTH = 128
const TILE_HEIGHT = 64

export type Game = {
  start: () => void
  stop: () => void
}

// Creates the game loop and scene attached to the given PixiJS app
export const createGame = (app: Application): Game => {
  let camera: Camera | null = null
  let playerAngle = 0
  const playerPos = { x: 0, y: 0 }

  const start = () => {
    // --- Camera ---
    camera = createCamera(app, {
      mapColumns: MAP_SIZE,
      mapRows: MAP_SIZE,
      tileWidth: TILE_WIDTH,
      tileHeight: TILE_HEIGHT,
    })

    // --- Tilemap ---
    const map = utils.tilemap.createTilemap(MAP_SIZE, MAP_SIZE)

    for (let i = 0; i < MAP_SIZE; i++) {
      utils.tilemap.setTile(map, i, 0, 'stone')
      utils.tilemap.setTile(map, i, MAP_SIZE - 1, 'stone')
      utils.tilemap.setTile(map, 0, i, 'stone')
      utils.tilemap.setTile(map, MAP_SIZE - 1, i, 'stone')
    }

    for (let y = 5; y <= 8; y++) {
      for (let x = 5; x <= 8; x++) {
        utils.tilemap.setTile(map, x, y, 'water')
      }
    }

    for (let i = 9; i < 16; i++) {
      utils.tilemap.setTile(map, i, 10, 'sand')
      utils.tilemap.setTile(map, i, 11, 'sand')
    }

    for (let y = 12; y <= 15; y++) {
      for (let x = 12; x <= 15; x++) {
        utils.tilemap.setTile(map, x, y, 'stone')
        utils.tilemap.setElevation(map, x, y, 2)
      }
    }

    for (let y = 11; y <= 16; y++) {
      utils.tilemap.setTile(map, 11, y, 'stone')
      utils.tilemap.setElevation(map, 11, y, 1)
    }
    for (let x = 12; x <= 15; x++) {
      utils.tilemap.setTile(map, x, 11, 'stone')
      utils.tilemap.setElevation(map, x, 11, 1)
    }

    const textures = buildTileTextures(app.renderer, TILE_WIDTH, TILE_HEIGHT)
    createTilemapRenderer(camera.worldContainer, map, TILE_WIDTH, TILE_HEIGHT, textures)

    // --- Placeholder player — orbits map center to demo follow + deadzone ---
    const mapCenter = utils.coordinateConversion.tileToScreen({
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
    })
    playerPos.x = mapCenter.x
    playerPos.y = mapCenter.y

    const playerMarker = new Graphics()
      .moveTo(0, -14)
      .lineTo(14, 0)
      .lineTo(0, 14)
      .lineTo(-14, 0)
      .closePath()
      .fill(0xffdd00)
      .stroke({ color: 0x000000, width: 1.5 })
    playerMarker.x = playerPos.x
    playerMarker.y = playerPos.y
    camera.worldContainer.addChild(playerMarker)

    camera.setFollowTarget(() => playerPos)

    // Demo screen shake — fires once 2s after start
    setTimeout(() => camera?.shake(12, 600), 2000)

    app.ticker.add(tick)
  }

  const stop = () => {
    app.ticker.remove(tick)
    camera?.destroy()
    camera = null
  }

  const tick = (ticker: Ticker) => {
    if (!camera) return

    // Orbit player around map center — demonstrates follow + deadzone
    playerAngle += ticker.deltaMS * 0.0008
    const orbitRadius = TILE_WIDTH * 2.5
    const mapCenter = utils.coordinateConversion.tileToScreen({
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
    })
    playerPos.x = mapCenter.x + Math.cos(playerAngle) * orbitRadius
    playerPos.y = mapCenter.y + Math.sin(playerAngle) * orbitRadius

    // Sync marker — find it by index (first non-tilemap child)
    const marker = camera.worldContainer.children[1]
    if (marker) {
      marker.x = playerPos.x
      marker.y = playerPos.y
    }

    camera.update(ticker.deltaMS)
  }

  return { start, stop }
}
