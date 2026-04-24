import type { Tilemap, TileType } from '../types/tile.js'

// Creates a new tilemap filled with a single tile type
export const createTilemap = (
  columns: number,
  rows: number,
  fill: TileType = 'grass',
): Tilemap => ({
  columns,
  rows,
  cells: new Array<TileType>(columns * rows).fill(fill),
})

// Returns the tile type at (x, y), or null if out of bounds
export const getTile = (map: Tilemap, x: number, y: number): TileType | null => {
  if (x < 0 || y < 0 || x >= map.columns || y >= map.rows) return null
  return map.cells[y * map.columns + x]
}

// Sets the tile type at (x, y) — no-op if out of bounds
export const setTile = (map: Tilemap, x: number, y: number, type: TileType): void => {
  if (x < 0 || y < 0 || x >= map.columns || y >= map.rows) return
  map.cells[y * map.columns + x] = type
}
