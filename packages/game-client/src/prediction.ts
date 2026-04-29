import { movement } from '@isoland/shared'
import type { Vec2 } from '@isoland/shared'

export interface PredictionBuffer {
  add(input: movement.PlayerInput, mapSize: number): void
  // Reconcile on receiving a server snapshot:
  //   1. drop all pending inputs with seq <= snapshot.lastProcessedSeq
  //   2. reset state to the server's authoritative position
  //   3. re-apply the remaining unacked inputs to arrive at the current predicted position
  reconcile(snapshot: movement.ServerSnapshot, mapSize: number): void
  getState(): movement.MovementState
}

// Creates a client-side prediction buffer seeded at the given spawn position.
export const createPredictionBuffer = (spawnPos: Vec2): PredictionBuffer => {
  let state: movement.MovementState = {
    position: { ...spawnPos },
    velocity: { x: 0, y: 0 },
  }
  let pending: movement.PlayerInput[] = []

  const add = (input: movement.PlayerInput, mapSize: number): void => {
    state = movement.applyInput(state, input, mapSize)
    pending.push(input)
  }

  const reconcile = (snapshot: movement.ServerSnapshot, mapSize: number): void => {
    // Keep only inputs the server has not yet processed
    pending = pending.filter((p) => p.seq > snapshot.lastProcessedSeq)
    // Reset to server authority then re-apply unacked inputs
    state = { position: { ...snapshot.position }, velocity: { ...snapshot.velocity } }
    for (const input of pending) {
      state = movement.applyInput(state, input, mapSize)
    }
  }

  const getState = (): movement.MovementState => state

  return { add, reconcile, getState }
}
