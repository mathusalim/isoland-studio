import { grid } from '@isoland/shared'

// Radii are equal for now (no hysteresis gap); widen EXIT_RADIUS when map grows
const ENTER_RADIUS = 2
const EXIT_RADIUS = 2

// Injected by callers — returns the IDs of all entities in a chunk key
type ChunkLookup = (chunkKey: string) => ReadonlySet<string>

export interface SubscriptionResult {
  spawned: string[]
  despawned: string[]
}

export interface SubscriptionManager {
  // Owner moved to a new tile — updates AoI and returns entities that entered/left visibility
  playerMoved(x: number, y: number, lookup: ChunkLookup): SubscriptionResult
  // Any other entity crossed a chunk boundary — checks if it entered/left this player's AoI
  entityChunkChanged(entityId: string, prevChunk: string, nextChunk: string): SubscriptionResult
  // Entity appeared in the world — adds to subscription if within AoI; returns true if added
  entitySpawned(entityId: string, chunkKey: string): boolean
  // Entity left the world — removes from subscription; returns true if it was subscribed
  entityDespawned(entityId: string): boolean
  getSubscribed(): ReadonlySet<string>
}

// One instance per connected player session
export const createSubscriptionManager = (
  ownerId: string,
  spawnX: number,
  spawnY: number,
): SubscriptionManager => {
  const tracker = grid.createHysteresisTracker(ENTER_RADIUS, EXIT_RADIUS)
  tracker.reset(spawnX, spawnY)
  const subscribed = new Set<string>()

  const playerMoved = (x: number, y: number, lookup: ChunkLookup): SubscriptionResult => {
    const { entered, exited } = tracker.update(x, y)
    const spawned: string[] = []
    const despawned: string[] = []

    for (const chunkKey of entered) {
      for (const id of lookup(chunkKey)) {
        if (id === ownerId || subscribed.has(id)) continue
        subscribed.add(id)
        spawned.push(id)
      }
    }

    for (const chunkKey of exited) {
      for (const id of lookup(chunkKey)) {
        if (id === ownerId || !subscribed.has(id)) continue
        subscribed.delete(id)
        despawned.push(id)
      }
    }

    return { spawned, despawned }
  }

  const entityChunkChanged = (
    entityId: string,
    prevChunk: string,
    nextChunk: string,
  ): SubscriptionResult => {
    if (entityId === ownerId) return { spawned: [], despawned: [] }
    const aoi = tracker.getAoI()
    const wasVisible = aoi.has(prevChunk)
    const isVisible = aoi.has(nextChunk)

    if (isVisible && !wasVisible) {
      if (subscribed.has(entityId)) return { spawned: [], despawned: [] }
      subscribed.add(entityId)
      return { spawned: [entityId], despawned: [] }
    }
    if (!isVisible && wasVisible) {
      if (!subscribed.has(entityId)) return { spawned: [], despawned: [] }
      subscribed.delete(entityId)
      return { spawned: [], despawned: [entityId] }
    }
    return { spawned: [], despawned: [] }
  }

  const entitySpawned = (entityId: string, chunkKey: string): boolean => {
    if (entityId === ownerId) return false
    if (tracker.getAoI().has(chunkKey)) {
      subscribed.add(entityId)
      return true
    }
    return false
  }

  const entityDespawned = (entityId: string): boolean => {
    if (subscribed.has(entityId)) {
      subscribed.delete(entityId)
      return true
    }
    return false
  }

  return {
    playerMoved,
    entityChunkChanged,
    entitySpawned,
    entityDespawned,
    getSubscribed: () => subscribed,
  }
}
