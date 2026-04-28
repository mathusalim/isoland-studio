import { addPlayer, getPlayer } from './state.js'
import { onEntityPositionUpdate } from './entityUpdater.js'

const botIds: string[] = []

// Spawn N bots at random positions; they participate in the subscription system like real players
export const initBots = (count: number, mapSize: number): void => {
  for (let i = 0; i < count; i++) {
    const id = `bot-${String(i).padStart(4, '0')}`
    const x = 1 + Math.floor(Math.random() * (mapSize - 2))
    const y = 1 + Math.floor(Math.random() * (mapSize - 2))
    addPlayer(id, id, { x, y })
    botIds.push(id)
  }
  console.log(`[bots] spawned ${count}`)
}

export type BotChunkUpdate = { id: string; prevChunkKey: string; nextChunkKey: string }

// Move each bot randomly; returns chunk-boundary crossings for subscription notification
export const tickBots = (mapSize: number): BotChunkUpdate[] => {
  const updates: BotChunkUpdate[] = []
  for (const id of botIds) {
    if (Math.random() > 0.25) continue // move ~25% of bots per tick
    const p = getPlayer(id)
    if (!p) continue
    const dx = Math.floor(Math.random() * 3) - 1
    const dy = Math.floor(Math.random() * 3) - 1
    const result = onEntityPositionUpdate(
      id,
      { x: p.position.x + dx, y: p.position.y + dy },
      mapSize,
    )
    if (result && result.prevChunkKey !== result.nextChunkKey) {
      updates.push({ id, prevChunkKey: result.prevChunkKey, nextChunkKey: result.nextChunkKey })
    }
  }
  return updates
}

export const getBotCount = (): number => botIds.length
