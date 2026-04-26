import { Graphics, type Renderer, type Texture } from 'pixi.js'
import type { TileType } from '@isoland/shared'

export const TILE_COLORS: Record<TileType, number> = {
  grass: 0x4a7c59,
  stone: 0x7a7a7a,
  water: 0x2e6fad,
  sand: 0xc2a062,
}

// Generates a diamond-shaped PixiJS texture for each tile type
export const buildTileTextures = (
  renderer: Renderer,
  tileWidth: number,
  tileHeight: number,
): Map<TileType, Texture> => {
  const textures = new Map<TileType, Texture>()
  for (const [type, color] of Object.entries(TILE_COLORS) as [TileType, number][]) {
    const g = new Graphics()
      .moveTo(tileWidth / 2, 0)
      .lineTo(tileWidth, tileHeight / 2)
      .lineTo(tileWidth / 2, tileHeight)
      .lineTo(0, tileHeight / 2)
      .closePath()
      .fill(color)
      .stroke({ color: 0x000000, width: 1, alpha: 0.25 })
    textures.set(type, renderer.generateTexture(g))
    g.destroy()
  }
  return textures
}
