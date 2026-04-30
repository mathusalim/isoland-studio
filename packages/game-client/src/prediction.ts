import { movement, resolveMovement, PLAYER_BOUNDS } from '@isoland/shared'
import type { Vec2, TileMap } from '@isoland/shared'

export interface PredictionBuffer {
  add(input: movement.PlayerInput, mapSize: number, tileMap?: TileMap): void
  // Reconcile on receiving a server snapshot:
  //   1. drop all pending inputs with seq <= snapshot.lastProcessedSeq
  //   2. reset state to the server's authoritative position
  //   3. re-apply the remaining unacked inputs to arrive at the current predicted position
  reconcile(snapshot: movement.ServerSnapshot, mapSize: number, tileMap?: TileMap): void
  getState(): movement.MovementState
}

// Creates a client-side prediction buffer seeded at the given spawn position.
export const createPredictionBuffer = (spawnPos: Vec2): PredictionBuffer => {
  let state: movement.MovementState = {
    position: { ...spawnPos },
    velocity: { x: 0, y: 0 },
  }
  let pending: movement.PlayerInput[] = []

  const add = (input: movement.PlayerInput, mapSize: number, tileMap?: TileMap): void => {
    const from = { ...state.position }
    state = movement.applyInput(state, input, mapSize)
    if (tileMap) {
      const resolved = resolveMovement(from, state.position, PLAYER_BOUNDS, tileMap)
      state = { ...state, position: resolved.position }
    }
    pending.push(input)
  }

  const reconcile = (
    snapshot: movement.ServerSnapshot,
    mapSize: number,
    tileMap?: TileMap,
  ): void => {
    pending = pending.filter((p) => p.seq > snapshot.lastProcessedSeq)
    state = { position: { ...snapshot.position }, velocity: { ...snapshot.velocity } }
    for (const input of pending) {
      const from = { ...state.position }
      state = movement.applyInput(state, input, mapSize)
      if (tileMap) {
        const resolved = resolveMovement(from, state.position, PLAYER_BOUNDS, tileMap)
        state = { ...state, position: resolved.position }
      }
    }
  }

  const getState = (): movement.MovementState => state

  return { add, reconcile, getState }
}
