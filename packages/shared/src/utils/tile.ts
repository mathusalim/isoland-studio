import type { Chunk } from '../types/chunk.js'
import type { Tile } from '../types/tile.js'

// Returns the chunk coordinates for a given tile
export const tileToChunk = (tile: Tile, chunk: Chunk): Chunk => ({
  chunkX: Math.floor(tile.x / chunk.size),
  chunkY: Math.floor(tile.y / chunk.size),
  size: chunk.size,
})

// Returns the top-left tile of a chunk
export const chunkToTile = (chunk: Chunk): Tile => ({
  x: chunk.chunkX * chunk.size,
  y: chunk.chunkY * chunk.size,
  width: chunk.size,
  height: chunk.size,
})

// Chebyshev distance between two tile positions
export const tileDistance = (a: Tile, b: Tile): number => {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

// All tiles within a square radius — used for AoI queries, aggro ranges
export const tilesInRadius = (centerX: number, centerY: number, radius: number): Tile[] => {
  const tiles: Tile[] = []
  for (let x = centerX - radius; x <= centerX + radius; x++) {
    for (let y = centerY - radius; y <= centerY + radius; y++) {
      tiles.push({ x, y, width: 1, height: 1 })
    }
  }
  return tiles
}

// Returns true if the tile coordinates are within the map bounds
export const isTileInBounds = (
  tileX: number,
  tileY: number,
  mapWidth: number,
  mapHeight: number,
): boolean => tileX >= 0 && tileY >= 0 && tileX < mapWidth && tileY < mapHeight
