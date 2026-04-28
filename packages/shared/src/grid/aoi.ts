import type { Vec2 } from '../types/math.js'
import { tileToChunk, chunkKey } from './coords.js'
import type { ChunkRegistry } from './registry.js'

// All chunk keys within `radius` chunks of a tile position (square neighbourhood)
export const aoiChunkKeys = (x: number, y: number, radius: number): Set<string> => {
  const cx = tileToChunk(x)
  const cy = tileToChunk(y)
  const keys = new Set<string>()
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      keys.add(chunkKey(cx + dx, cy + dy))
    }
  }
  return keys
}

// Pure diff between two AoI chunk sets — drives ENTITY_SPAWN / ENTITY_DESPAWN
export const aoiDiff = (
  prev: ReadonlySet<string>,
  next: ReadonlySet<string>,
): { entered: Set<string>; exited: Set<string> } => {
  const entered = new Set<string>()
  const exited = new Set<string>()
  for (const k of next) if (!prev.has(k)) entered.add(k)
  for (const k of prev) if (!next.has(k)) exited.add(k)
  return { entered, exited }
}

export interface HysteresisTracker {
  // Call on every position update; returns which chunks were entered/exited
  update(x: number, y: number): { entered: Set<string>; exited: Set<string> }
  // Teleport: reset AoI without producing diff events
  reset(x: number, y: number): void
  // Current tracked AoI chunk set
  getAoI(): ReadonlySet<string>
}

// Prevents boundary flickering: entities enter at `enterRadius`, only exit when beyond `exitRadius`
export const createHysteresisTracker = (
  enterRadius: number,
  exitRadius: number,
): HysteresisTracker => {
  let current = new Set<string>()

  const update = (x: number, y: number): { entered: Set<string>; exited: Set<string> } => {
    const enterSet = aoiChunkKeys(x, y, enterRadius)
    const exitSet = aoiChunkKeys(x, y, exitRadius)
    const entered = new Set<string>()
    const exited = new Set<string>()
    for (const k of enterSet) {
      if (!current.has(k)) {
        entered.add(k)
        current.add(k)
      }
    }
    for (const k of current) {
      if (!exitSet.has(k)) {
        exited.add(k)
        current.delete(k)
      }
    }
    return { entered, exited }
  }

  const reset = (x: number, y: number): void => {
    current = aoiChunkKeys(x, y, enterRadius)
  }

  const getAoI = (): ReadonlySet<string> => current

  return { update, reset, getAoI }
}

// All entities in the AoI of a tile position, de-duplicated across chunk boundaries
export const getEntitiesInAoI = <T extends { id: string; position: Vec2 }>(
  x: number,
  y: number,
  radius: number,
  registry: ChunkRegistry<T>,
): T[] => {
  const chunks = aoiChunkKeys(x, y, radius)
  const seen = new Set<string>()
  const result: T[] = []
  for (const ck of chunks) {
    for (const id of registry.getChunk(ck)) {
      if (seen.has(id)) continue
      seen.add(id)
      const entity = registry.getEntity(id)
      if (entity) result.push(entity)
    }
  }
  return result
}
