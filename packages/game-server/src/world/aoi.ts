const CHUNK_SIZE = 8 // tiles per chunk edge
const AOI_RADIUS = 2 // chunks in each direction from the player

const tileToChunk = (t: number): number => Math.floor(t / CHUNK_SIZE)

// Canonical string key for the chunk containing tile (x, y)
export const chunkKey = (x: number, y: number): string => `${tileToChunk(x)},${tileToChunk(y)}`

// All chunk keys within AOI_RADIUS of the given tile position
export const aoiChunkKeys = (x: number, y: number): Set<string> => {
  const cx = tileToChunk(x)
  const cy = tileToChunk(y)
  const keys = new Set<string>()
  for (let dy = -AOI_RADIUS; dy <= AOI_RADIUS; dy++) {
    for (let dx = -AOI_RADIUS; dx <= AOI_RADIUS; dx++) {
      keys.add(`${cx + dx},${cy + dy}`)
    }
  }
  return keys
}
