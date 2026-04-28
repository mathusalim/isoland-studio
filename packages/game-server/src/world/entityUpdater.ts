import type { Vec2 } from '@isoland/shared'
import { grid } from '@isoland/shared'
import { AOI_RADIUS, getPlayer, movePlayer } from './state.js'

export type PositionUpdateResult =
  | { newPos: Vec2; chunkChanged: false }
  | { newPos: Vec2; chunkChanged: true; enteredChunks: Set<string>; exitedChunks: Set<string> }

// Atomically updates an entity's position in the grid.
// Returns the AoI chunk diff when a chunk boundary is crossed, null if entity not found.
export const onEntityPositionUpdate = (
  entityId: string,
  dest: Vec2,
  mapSize: number,
): PositionUpdateResult | null => {
  const entity = getPlayer(entityId)
  if (!entity) return null

  // Capture AoI before the move so we can diff against it
  const prevAoI = grid.aoiChunkKeys(entity.position.x, entity.position.y, AOI_RADIUS)
  const prevChunk = grid.tileChunkKey(entity.position.x, entity.position.y)

  const newPos = movePlayer(entityId, dest, mapSize)
  if (!newPos) return null

  if (grid.tileChunkKey(newPos.x, newPos.y) === prevChunk) {
    return { newPos, chunkChanged: false }
  }

  const nextAoI = grid.aoiChunkKeys(newPos.x, newPos.y, AOI_RADIUS)
  const { entered, exited } = grid.aoiDiff(prevAoI, nextAoI)
  return { newPos, chunkChanged: true, enteredChunks: entered, exitedChunks: exited }
}
