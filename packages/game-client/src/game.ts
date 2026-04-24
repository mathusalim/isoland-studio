import type { Application, Ticker } from 'pixi.js'
import { utils } from '@isoland/shared'
import { buildTileTextures } from './tilemap/tileTextures.js'
import { createTilemapRenderer } from './tilemap/TilemapRenderer.js'
import type { TilemapRenderer } from './tilemap/TilemapRenderer.js'

const MAP_SIZE = 20
const TILE_WIDTH = 128
const TILE_HEIGHT = 64

export type Game = {
  start: () => void
  stop: () => void
}

// Creates the game loop and scene attached to the given PixiJS app
export const createGame = (app: Application): Game => {
  let tilemapRenderer: TilemapRenderer | null = null

  const start = () => {
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

    const textures = buildTileTextures(app.renderer, TILE_WIDTH, TILE_HEIGHT)
    tilemapRenderer = createTilemapRenderer(app.stage, map, TILE_WIDTH, TILE_HEIGHT, textures)

    const center = utils.coordinateConversion.tileToScreen({
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
    })
    tilemapRenderer.container.x = app.screen.width / 2 - center.x
    tilemapRenderer.container.y = app.screen.height / 4 - center.y

    app.ticker.add(tick)
  }

  const stop = () => {
    app.ticker.remove(tick)
    tilemapRenderer?.destroy()
    tilemapRenderer = null
  }

  const tick = (_ticker: Ticker) => {
    // game loop
  }

  return { start, stop }
}
