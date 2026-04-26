import type { Tile } from '../types/tile.js'

// Isometric draw order — tiles on higher diagonals (x+y+elevation) render last
export const tileDepth = (tile: Tile, elevation = 0, layer = 0): number =>
  (tile.x + tile.y + elevation) * 100 + layer

// Entity depth — sits above tiles on the same diagonal; heightOffset separates stacked entities
export const entityDepth = (tile: Tile, elevation = 0, heightOffset = 0): number =>
  (tile.x + tile.y + elevation) * 100 + 50 + heightOffset

// Pixel offset for a given Z height (cliffs, flying, projectile arcs)
export const elevationToScreenY = (elevation: number): number => elevation * 100
