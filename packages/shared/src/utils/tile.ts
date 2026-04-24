import { Chunk } from '../types/chunk'
import { Tile } from '../types/tile'

//needed for your AoI spatial grid
export const tileToChunk = (tile: Tile, chunk: Chunk): Chunk => ({
  chunkX: Math.floor(tile.x / chunk.size),
  chunkY: Math.floor(tile.y / chunk.size),
  size: chunk.size,
})

// top-left tile of a chunk
export const chunkToTile = (chunk: Chunk): Tile => ({
  x: chunk.chunkX * chunk.size,
  y: chunk.chunkY * chunk.size,
  width: chunk.size,
  height: chunk.size,
})

// tileDistance(a, b) → number — Chebyshev or Manhattan distance between two tile positions
export const tileDistance = (a: Tile, b: Tile): number => {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

// tilesInRadius(centerX, centerY, radius) → TileCoord[] — used for AoI queries, AoE skills, aggro ranges
export const tilesInRadius = (centerX: number, centerY: number, radius: number): Tile[] => {
  const tiles: Tile[] = []
  for (let x = centerX - radius; x <= centerX + radius; x++) {
    for (let y = centerY - radius; y <= centerY + radius; y++) {
      tiles.push({ x: x, y: y, width: 1, height: 1 })
    }
  }
  return tiles
}

// isTileInBounds(tileX, tileY, mapWidth, mapHeight) → boolean
export const isTileInBounds = (
  tileX: number,
  tileY: number,
  mapWidth: number,
  mapHeight: number,
): boolean => {
  return tileX >= 0 && tileY >= 0 && tileX < mapWidth && tileY < mapHeight
}
