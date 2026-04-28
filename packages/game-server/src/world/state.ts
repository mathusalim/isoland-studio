import type { Vec2 } from '@isoland/shared'
import { grid } from '@isoland/shared'

export const AOI_RADIUS = 2

export interface PlayerState {
  id: string
  name: string
  position: Vec2
}

const registry = grid.createChunkRegistry<PlayerState>()

// Register a new player at the given spawn position
export const addPlayer = (id: string, name: string, position: Vec2): void => {
  registry.add({ id, name, position: { x: position.x, y: position.y } })
}

// Remove a player from the world
export const removePlayer = (id: string): void => registry.remove(id)

// Clamp destination to [0, mapSize) and update the spatial index; returns new position
export const movePlayer = (id: string, dest: Vec2, mapSize: number): Vec2 | null => {
  const p = registry.getEntity(id)
  if (!p) return null
  const nx = Math.max(0, Math.min(mapSize - 1, Math.round(dest.x)))
  const ny = Math.max(0, Math.min(mapSize - 1, Math.round(dest.y)))
  registry.move(id, { x: nx, y: ny })
  return p.position
}

// All players within AoI of the given player (includes self)
export const getAoIPlayers = (id: string): PlayerState[] => {
  const p = registry.getEntity(id)
  if (!p) return []
  return grid.getEntitiesInAoI(p.position.x, p.position.y, AOI_RADIUS, registry)
}

// Entity IDs in a specific chunk key — used by SubscriptionManager as a ChunkLookup
export const getPlayerIdsInChunk = (key: string): ReadonlySet<string> => registry.getChunk(key)

export const getAllPlayers = (): PlayerState[] => registry.getAll()
export const getPlayer = (id: string): PlayerState | undefined => registry.getEntity(id)
