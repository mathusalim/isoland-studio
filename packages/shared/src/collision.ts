import type { Vec2 } from './types/math.js'

// Passed to resolveCollision so future implementations can accept tile data
// without changing the function signature.
export interface CollisionContext {
  mapSize: number
  // Future: collidableTiles: ReadonlySet<string>, staticBodies: Rect[], etc.
}

// Resolve a position against world geometry and return the nearest valid position.
// Stub implementation — enforces map bounds only.
// Replace body when tile collision data is available; keep the signature stable.
export const resolveCollision = (position: Vec2, ctx: CollisionContext): Vec2 => {
  const x = Math.max(0, Math.min(ctx.mapSize - 1, position.x))
  const y = Math.max(0, Math.min(ctx.mapSize - 1, position.y))
  return { x, y }
}
