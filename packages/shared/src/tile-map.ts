import type { Vec2 } from './types/math.js'

// World-space position in tile units (alias of Vec2 for semantic clarity)
export type WorldPos = Vec2

// Integer tile index within a TileMap
export interface TileCoord {
  tx: number
  ty: number
}

// Half-extents of a player's AABB in tile units
export interface PlayerBounds {
  halfW: number
  halfH: number
}

// Tile IDs:
//   0 = walkable floor
//   1 = solid (wall / border) — blocks movement
//   2 = water — walkable, triggers 'slow' effect
//   3 = lava  — walkable, triggers 'deadly' effect
export interface TileMap {
  width: number
  height: number
  tiles: Uint8Array
}

// Returns the tile ID at (tx, ty). Out-of-bounds coordinates return 1 (solid).
export const getTileAt = (map: TileMap, tx: number, ty: number): number => {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return 1
  return map.tiles[ty * map.width + tx]
}

// Convert a world-space position to the containing tile's integer indices
export const worldToTile = (pos: WorldPos): TileCoord => ({
  tx: Math.floor(pos.x),
  ty: Math.floor(pos.y),
})

// World-space center of the tile at (tx, ty)
export const tileToWorld = (coord: TileCoord): WorldPos => ({
  x: coord.tx + 0.5,
  y: coord.ty + 0.5,
})

// Clamp a world-space position to the interior of the map
export const clampToMap = (pos: WorldPos, map: TileMap): WorldPos => ({
  x: Math.max(0, Math.min(map.width - 1, pos.x)),
  y: Math.max(0, Math.min(map.height - 1, pos.y)),
})

// Deserialise a plain-object map (e.g. from JSON) into a TileMap with a typed Uint8Array
export const parseTileMap = (raw: { width: number; height: number; tiles: number[] }): TileMap => ({
  width: raw.width,
  height: raw.height,
  tiles: new Uint8Array(raw.tiles),
})
