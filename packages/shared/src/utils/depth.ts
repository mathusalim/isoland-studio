import type { Tile } from '../types/tile.js'

// sort value for painter's algorithm; critical for correct draw order
export const tileDepth = (tile: Tile, layer: number = 0): number => {
  return tile.x * 1000 + tile.y * 100 + layer
}

// same but for characters/objects sitting on tiles
export const entityDepth = (tile: Tile, heightOffset: number): number => {
  return tile.y * 1000 + tile.x * 100 + heightOffset
}

// pixel offset for a given Z height (cliffs, flying, projectile arcs)
export const elevationToScreenY = (elevation: number): number => {
  return elevation * 100
}
