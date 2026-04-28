import type { Vec2 } from '../types/math.js'
import { chunkTileMin, chunkTileMax, parseChunkKey } from './coords.js'
import type { ChunkRegistry } from './registry.js'

export interface ChunkDebugInfo {
  key: string
  cx: number
  cy: number
  entityCount: number
  // Inclusive tile bounds of the chunk
  tileBounds: { minX: number; minY: number; maxX: number; maxY: number }
}

// Snapshot of all occupied chunks with entity counts and tile bounds
export const getDebugInfo = <T extends { id: string; position: Vec2 }>(
  registry: ChunkRegistry<T>,
): ChunkDebugInfo[] =>
  registry.getOccupiedChunks().map((key) => {
    const { cx, cy } = parseChunkKey(key)
    return {
      key,
      cx,
      cy,
      entityCount: registry.getChunkEntityCount(key),
      tileBounds: {
        minX: chunkTileMin(cx),
        minY: chunkTileMin(cy),
        maxX: chunkTileMax(cx),
        maxY: chunkTileMax(cy),
      },
    }
  })
