import type { Vec2 } from '@isoland/shared'
import { grid } from '@isoland/shared'
import { getPlayer, movePlayer } from './state.js'

export type PositionUpdateResult = {
  newPos: Vec2
  prevChunkKey: string
  nextChunkKey: string
}

// Atomically updates an entity's position in the grid; returns prev/next chunk keys for AoI diffing
export const onEntityPositionUpdate = (
  entityId: string,
  dest: Vec2,
  mapSize: number,
): PositionUpdateResult | null => {
  const entity = getPlayer(entityId)
  if (!entity) return null

  const prevChunkKey = grid.tileChunkKey(entity.position.x, entity.position.y)

  const newPos = movePlayer(entityId, dest, mapSize)
  if (!newPos) return null

  return { newPos, prevChunkKey, nextChunkKey: grid.tileChunkKey(newPos.x, newPos.y) }
}
