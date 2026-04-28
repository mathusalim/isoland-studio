import type { Vec2 } from '@isoland/shared'
import { chunkKey, aoiChunkKeys } from './aoi.js'

export interface PlayerState {
  id: string
  name: string
  position: Vec2
  currentChunk: string
}

const players = new Map<string, PlayerState>()
// chunkKey → set of player IDs in that chunk
const chunkIndex = new Map<string, Set<string>>()

const chunkSet = (key: string): Set<string> => {
  let s = chunkIndex.get(key)
  if (!s) {
    s = new Set()
    chunkIndex.set(key, s)
  }
  return s
}

export const addPlayer = (id: string, name: string, position: Vec2): void => {
  const ck = chunkKey(position.x, position.y)
  players.set(id, { id, name, position: { x: position.x, y: position.y }, currentChunk: ck })
  chunkSet(ck).add(id)
}

export const removePlayer = (id: string): void => {
  const p = players.get(id)
  if (!p) return
  chunkIndex.get(p.currentChunk)?.delete(id)
  players.delete(id)
}

// Clamps destination to [0, mapSize) and updates the chunk index. Returns the player's new position.
export const movePlayer = (id: string, dest: Vec2, mapSize: number): Vec2 | null => {
  const p = players.get(id)
  if (!p) return null
  const nx = Math.max(0, Math.min(mapSize - 1, Math.round(dest.x)))
  const ny = Math.max(0, Math.min(mapSize - 1, Math.round(dest.y)))
  const prevChunk = p.currentChunk
  const nextChunk = chunkKey(nx, ny)
  p.position.x = nx
  p.position.y = ny
  if (prevChunk !== nextChunk) {
    chunkIndex.get(prevChunk)?.delete(id)
    p.currentChunk = nextChunk
    chunkSet(nextChunk).add(id)
  }
  return p.position
}

// Returns all players within AoI of the given player (includes self)
export const getAoIPlayers = (id: string): PlayerState[] => {
  const p = players.get(id)
  if (!p) return []
  const aoi = aoiChunkKeys(p.position.x, p.position.y)
  const seen = new Set<string>()
  const result: PlayerState[] = []
  for (const ck of aoi) {
    const chunk = chunkIndex.get(ck)
    if (!chunk) continue
    for (const pid of chunk) {
      if (seen.has(pid)) continue
      seen.add(pid)
      const ps = players.get(pid)
      if (ps) result.push(ps)
    }
  }
  return result
}

export const getAllPlayers = (): PlayerState[] => [...players.values()]

export const getPlayer = (id: string): PlayerState | undefined => players.get(id)
