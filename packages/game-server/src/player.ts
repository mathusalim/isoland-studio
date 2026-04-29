import { movement, grid } from '@isoland/shared'
import type { Vec2 } from '@isoland/shared'
import { getPlayer, setPlayerState } from './world/state.js'

export type InputProcessResult = {
  newPos: Vec2
  prevChunkKey: string
  nextChunkKey: string
}

export interface InputProcessor {
  enqueue(input: movement.PlayerInput): void
  // Drain the input queue and apply all inputs against the authoritative state.
  // Returns the chunk-boundary result, or null if no inputs were queued.
  processAll(mapSize: number): InputProcessResult | null
  getLastProcessedSeq(): number
}

// Per-player input processor for client-side prediction reconciliation.
// The server enqueues inputs during the message handler and drains them each tick.
export const createInputProcessor = (entityId: string): InputProcessor => {
  let lastProcessedSeq = -1
  const queue: movement.PlayerInput[] = []

  const enqueue = (input: movement.PlayerInput): void => {
    queue.push(input)
  }

  const processAll = (mapSize: number): InputProcessResult | null => {
    if (queue.length === 0) return null
    const p = getPlayer(entityId)
    if (!p) {
      queue.length = 0
      return null
    }

    const prevChunkKey = grid.tileChunkKey(p.position.x, p.position.y)
    let state: movement.MovementState = {
      position: { ...p.position },
      velocity: { ...p.velocity },
    }

    for (const input of queue) {
      state = movement.applyInput(state, input, mapSize)
      lastProcessedSeq = input.seq
    }
    queue.length = 0

    setPlayerState(entityId, state.position, state.velocity)
    const nextChunkKey = grid.tileChunkKey(state.position.x, state.position.y)

    return { newPos: { ...state.position }, prevChunkKey, nextChunkKey }
  }

  const getLastProcessedSeq = (): number => lastProcessedSeq

  return { enqueue, processAll, getLastProcessedSeq }
}
