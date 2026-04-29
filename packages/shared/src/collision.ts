import type { Vec2 } from './types/math.js'
import type { TileMap, PlayerBounds } from './tile-map.js'
import { getTileAt } from './tile-map.js'

export type TileEffect = 'none' | 'slow' | 'deadly'

export interface ResolvedMovement {
  position: Vec2
  effect: TileEffect
}

const isSolid = (tileId: number): boolean => tileId === 1

const tileEffect = (tileId: number): TileEffect => {
  if (tileId === 2) return 'slow'
  if (tileId === 3) return 'deadly'
  return 'none'
}

// Returns the tile effect at the center of the player's position
const sampleEffect = (pos: Vec2, map: TileMap): TileEffect =>
  tileEffect(getTileAt(map, Math.floor(pos.x), Math.floor(pos.y)))

// Samples 5 AABB points (4 corners + center) against solid tiles
const isBlocked = (pos: Vec2, bounds: PlayerBounds, map: TileMap): boolean => {
  const { halfW, halfH } = bounds
  const solid = (x: number, y: number) => isSolid(getTileAt(map, Math.floor(x), Math.floor(y)))
  return (
    solid(pos.x - halfW, pos.y - halfH) ||
    solid(pos.x + halfW, pos.y - halfH) ||
    solid(pos.x - halfW, pos.y + halfH) ||
    solid(pos.x + halfW, pos.y + halfH) ||
    solid(pos.x, pos.y)
  )
}

// Resolves movement from `from` toward `to` against tile geometry.
// Strategy: try full → X-only slide → Y-only slide → stay.
// When both slide axes are free, the dominant displacement axis wins.
export const resolveMovement = (
  from: Vec2,
  to: Vec2,
  bounds: PlayerBounds,
  map: TileMap,
): ResolvedMovement => {
  if (!isBlocked(to, bounds, map)) {
    return { position: { ...to }, effect: sampleEffect(to, map) }
  }

  const dx = to.x - from.x
  const dy = to.y - from.y
  const xOnly: Vec2 = { x: to.x, y: from.y }
  const yOnly: Vec2 = { x: from.x, y: to.y }
  const xFree = !isBlocked(xOnly, bounds, map)
  const yFree = !isBlocked(yOnly, bounds, map)

  if (xFree && yFree) {
    const pos = Math.abs(dx) >= Math.abs(dy) ? xOnly : yOnly
    return { position: { ...pos }, effect: sampleEffect(pos, map) }
  }
  if (xFree) return { position: { ...xOnly }, effect: sampleEffect(xOnly, map) }
  if (yFree) return { position: { ...yOnly }, effect: sampleEffect(yOnly, map) }
  return { position: { ...from }, effect: sampleEffect(from, map) }
}
