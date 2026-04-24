import type { Tile } from '../types/tile.js'

// Returns tile positions in a cone pattern
export const tilesInCone = (
  origin: Tile,
  directionAngle: number,
  length: number,
  halfAngle: number,
): Tile[] => {
  const result: Tile[] = []
  for (let x = origin.x - length; x <= origin.x + length; x++) {
    for (let y = origin.y - length; y <= origin.y + length; y++) {
      const dx = x - origin.x
      const dy = y - origin.y
      const dist2 = dx * dx + dy * dy
      if (dist2 === 0 || dist2 > length * length) continue
      const angle = Math.atan2(dy, dx)
      const diff = Math.atan2(Math.sin(angle - directionAngle), Math.cos(angle - directionAngle))
      if (Math.abs(diff) <= halfAngle) result.push({ ...origin, x, y })
    }
  }
  return result
}

// Returns tile positions in a line/beam pattern
export const tilesInLine = (origin: Tile, target: Tile, width: number): Tile[] => {
  const result: Tile[] = []
  const segDx = target.x - origin.x
  const segDy = target.y - origin.y
  const segLen2 = segDx * segDx + segDy * segDy
  const pad = Math.ceil(width / 2)
  const minX = Math.min(origin.x, target.x) - pad
  const maxX = Math.max(origin.x, target.x) + pad
  const minY = Math.min(origin.y, target.y) - pad
  const maxY = Math.max(origin.y, target.y) + pad

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      let perpDx: number
      let perpDy: number
      if (segLen2 === 0) {
        perpDx = x - origin.x
        perpDy = y - origin.y
      } else {
        const t = Math.max(
          0,
          Math.min(1, ((x - origin.x) * segDx + (y - origin.y) * segDy) / segLen2),
        )
        perpDx = x - (origin.x + t * segDx)
        perpDy = y - (origin.y + t * segDy)
      }
      if (perpDx * perpDx + perpDy * perpDy <= (width / 2) * (width / 2))
        result.push({ ...origin, x, y })
    }
  }
  return result
}

// Returns tile positions in an arc pattern
export const tilesInArc = (
  origin: Tile,
  directionAngle: number,
  radius: number,
  arcAngle: number,
): Tile[] => {
  const result: Tile[] = []
  for (let x = origin.x - radius; x <= origin.x + radius; x++) {
    for (let y = origin.y - radius; y <= origin.y + radius; y++) {
      const dx = x - origin.x
      const dy = y - origin.y
      const dist2 = dx * dx + dy * dy
      if (dist2 === 0 || dist2 > radius * radius) continue
      const angle = Math.atan2(dy, dx)
      const diff = Math.atan2(Math.sin(angle - directionAngle), Math.cos(angle - directionAngle))
      if (Math.abs(diff) <= arcAngle / 2) result.push({ ...origin, x, y })
    }
  }
  return result
}

// Returns tile positions in a nova/sphere pattern
export const tilesInNova = (origin: Tile, radius: number): Tile[] => {
  const result: Tile[] = []
  for (let x = origin.x - radius; x <= origin.x + radius; x++) {
    for (let y = origin.y - radius; y <= origin.y + radius; y++) {
      const dx = x - origin.x
      const dy = y - origin.y
      if (dx * dx + dy * dy <= radius * radius) result.push({ ...origin, x, y })
    }
  }
  return result
}

// Returns tile positions in a chain pattern
export const tilesInChain = (
  origin: Tile,
  targets: Tile[],
  maxBounces: number,
  bounceRange: number,
): Tile[] => {
  const result: Tile[] = []
  const visited = new Set<number>()
  let current = origin

  for (let bounce = 0; bounce < maxBounces; bounce++) {
    let nearestIdx = -1
    let nearestDist = Infinity
    for (let i = 0; i < targets.length; i++) {
      if (visited.has(i)) continue
      const dx = targets[i].x - current.x
      const dy = targets[i].y - current.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= bounceRange && dist < nearestDist) {
        nearestDist = dist
        nearestIdx = i
      }
    }
    if (nearestIdx === -1) break
    visited.add(nearestIdx)
    result.push(targets[nearestIdx])
    current = targets[nearestIdx]
  }

  return result
}
