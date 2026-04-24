import type { ScreenPosition } from '../types/screen.js'
import type { Tile } from '../types/tile.js'
import type { WorldPosition } from '../types/world.js'

// Returns the top vertex of the tile diamond — use this to place tile sprites (anchor at top-center)
export const tileToScreen = (tile: Tile): ScreenPosition => ({
  x: ((tile.x - tile.y) * tile.width) / 2,
  y: ((tile.x + tile.y) * tile.height) / 2,
})

// Returns the center of the tile diamond — use this to place entities standing on a tile
export const tileToScreenCenter = (tile: Tile): ScreenPosition => ({
  x: ((tile.x - tile.y) * tile.width) / 2,
  y: ((tile.x + tile.y) * tile.height) / 2 + tile.height / 2,
})

// Projects 3D world coords to 2D screen — elevation shifts the sprite straight up by z * tileHeight
export const worldToScreen = (world: WorldPosition, tile: Tile): ScreenPosition => ({
  x: ((world.x - world.y) * tile.width) / 2,
  y: ((world.x + world.y) * tile.height) / 2 - world.z * tile.height,
})

// Projects 2D screen coords to 3D world — z is the elevation, with positive values indicating the sprite is above the ground
export const screenToWorld = (position: ScreenPosition, tile: Tile): WorldPosition => ({
  x: (position.x / tile.width + position.y / tile.height) / 2,
  y: (position.y / tile.height - position.x / tile.width) / 2,
  z: -position.y / tile.height + position.x / tile.width,
})

// Returns the tile coordinates for a given screen position
export const screenToTile = (position: ScreenPosition, tile: Tile): Tile => ({
  ...tile,
  x: Math.floor(position.x / tile.width + position.y / tile.height),
  y: Math.floor(position.y / tile.height - position.x / tile.width),
})
