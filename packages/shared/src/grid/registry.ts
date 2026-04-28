import type { Vec2 } from '../types/math.js'
import { tileChunkKey } from './coords.js'

export interface ChunkRegistry<T extends { id: string; position: Vec2 }> {
  // Register a new entity; no-op if the id already exists
  add(entity: T): void
  // Remove entity by id; no-op if not found
  remove(id: string): void
  // Update entity position in-place and move it to the correct chunk
  move(id: string, position: Vec2): void
  // IDs of all entities in a single chunk
  getChunk(key: string): ReadonlySet<string>
  getEntity(id: string): T | undefined
  getAll(): T[]
  // Chunk key the entity currently occupies
  getEntityChunkKey(id: string): string | undefined
  // Chunk keys with at least one entity
  getOccupiedChunks(): string[]
  getChunkEntityCount(key: string): number
}

// Factory for a spatial index mapping entities to chunks
export const createChunkRegistry = <
  T extends { id: string; position: Vec2 },
>(): ChunkRegistry<T> => {
  const entities = new Map<string, T>()
  const chunkIndex = new Map<string, Set<string>>()
  const entityChunk = new Map<string, string>()

  const chunkSet = (key: string): Set<string> => {
    let s = chunkIndex.get(key)
    if (!s) {
      s = new Set()
      chunkIndex.set(key, s)
    }
    return s
  }

  const add = (entity: T): void => {
    if (entities.has(entity.id)) return
    const ck = tileChunkKey(entity.position.x, entity.position.y)
    entities.set(entity.id, entity)
    chunkSet(ck).add(entity.id)
    entityChunk.set(entity.id, ck)
  }

  const remove = (id: string): void => {
    const ck = entityChunk.get(id)
    if (ck) {
      chunkIndex.get(ck)?.delete(id)
      entityChunk.delete(id)
    }
    entities.delete(id)
  }

  const move = (id: string, position: Vec2): void => {
    const entity = entities.get(id)
    if (!entity) return
    const prevCk = entityChunk.get(id)
    const nextCk = tileChunkKey(position.x, position.y)
    entity.position.x = position.x
    entity.position.y = position.y
    if (prevCk !== nextCk) {
      if (prevCk) chunkIndex.get(prevCk)?.delete(id)
      chunkSet(nextCk).add(id)
      entityChunk.set(id, nextCk)
    }
  }

  const getChunk = (key: string): ReadonlySet<string> => chunkIndex.get(key) ?? new Set()

  const getEntity = (id: string): T | undefined => entities.get(id)

  const getAll = (): T[] => [...entities.values()]

  const getEntityChunkKey = (id: string): string | undefined => entityChunk.get(id)

  const getOccupiedChunks = (): string[] =>
    [...chunkIndex.entries()].filter(([, s]) => s.size > 0).map(([k]) => k)

  const getChunkEntityCount = (key: string): number => chunkIndex.get(key)?.size ?? 0

  return {
    add,
    remove,
    move,
    getChunk,
    getEntity,
    getAll,
    getEntityChunkKey,
    getOccupiedChunks,
    getChunkEntityCount,
  }
}
