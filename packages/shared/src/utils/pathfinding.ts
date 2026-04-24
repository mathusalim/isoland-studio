import type { Tile } from '../types/tile.js'

const CARDINAL = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

const DIAGONAL = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

// Returns 4 cardinal or 8 (cardinal + diagonal) neighboring tile positions
export const tileNeighbors = (tile: Tile, includeDiagonals: boolean): Tile[] => {
  const dirs = includeDiagonals ? [...CARDINAL, ...DIAGONAL] : CARDINAL
  return dirs.map(([dx, dy]) => ({ ...tile, x: tile.x + dx, y: tile.y + dy }))
}

// Octile distance — accurate A* heuristic when diagonal moves cost √2
export const heuristicDistance = (a: Tile, b: Tile): number => {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
}

// A* — returns tile path from start to end (inclusive), empty array if unreachable
export const tilesToPath = (
  start: Tile,
  end: Tile,
  isWalkable: (x: number, y: number) => boolean,
  includeDiagonals = true,
): Tile[] => {
  const key = (x: number, y: number) => `${x},${y}`
  const startKey = key(start.x, start.y)
  const endKey = key(end.x, end.y)

  type Node = { tile: Tile; f: number; g: number }
  const heap: Node[] = []

  const heapPush = (node: Node) => {
    heap.push(node)
    let i = heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (heap[parent].f <= heap[i].f) break
      ;[heap[parent], heap[i]] = [heap[i], heap[parent]]
      i = parent
    }
  }

  const heapPop = (): Node => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length > 0) {
      heap[0] = last
      let i = 0
      while (true) {
        const l = 2 * i + 1
        const r = 2 * i + 2
        let min = i
        if (l < heap.length && heap[l].f < heap[min].f) min = l
        if (r < heap.length && heap[r].f < heap[min].f) min = r
        if (min === i) break
        ;[heap[i], heap[min]] = [heap[min], heap[i]]
        i = min
      }
    }
    return top
  }

  const gScore = new Map<string, number>([[startKey, 0]])
  const cameFrom = new Map<string, string>()
  const tileAt = new Map<string, Tile>([[startKey, start]])
  const closed = new Set<string>()

  heapPush({ tile: start, f: heuristicDistance(start, end), g: 0 })

  while (heap.length > 0) {
    const { tile: current, g } = heapPop()
    const currentKey = key(current.x, current.y)

    if (currentKey === endKey) {
      const path: Tile[] = []
      let k = endKey
      while (k !== startKey) {
        path.push(tileAt.get(k)!)
        k = cameFrom.get(k)!
      }
      path.push(start)
      return path.reverse()
    }

    if (closed.has(currentKey)) continue
    closed.add(currentKey)

    for (const neighbor of tileNeighbors(current, includeDiagonals)) {
      const nKey = key(neighbor.x, neighbor.y)
      if (closed.has(nKey) || !isWalkable(neighbor.x, neighbor.y)) continue

      const isDiagonal = neighbor.x !== current.x && neighbor.y !== current.y
      const tentativeG = g + (isDiagonal ? Math.SQRT2 : 1)

      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentativeG)
        cameFrom.set(nKey, currentKey)
        tileAt.set(nKey, neighbor)
        heapPush({ tile: neighbor, f: tentativeG + heuristicDistance(neighbor, end), g: tentativeG })
      }
    }
  }

  return []
}
