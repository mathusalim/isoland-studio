// Tiles per chunk edge — both server and client must agree on this value
export const CHUNK_SIZE = 8

// Tile coordinate → chunk coordinate along one axis
export const tileToChunk = (t: number): number => Math.floor(t / CHUNK_SIZE)

// Chunk x,y → canonical string key used as Map keys everywhere
export const chunkKey = (cx: number, cy: number): string => `${cx},${cy}`

// Tile position → chunk key in one step
export const tileChunkKey = (x: number, y: number): string =>
  chunkKey(tileToChunk(x), tileToChunk(y))

// First tile index inside a chunk (inclusive)
export const chunkTileMin = (c: number): number => c * CHUNK_SIZE

// Last tile index inside a chunk (inclusive)
export const chunkTileMax = (c: number): number => (c + 1) * CHUNK_SIZE - 1

// Parse a chunk key string back to chunk coordinates
export const parseChunkKey = (key: string): { cx: number; cy: number } => {
  const comma = key.indexOf(',')
  return { cx: Number(key.slice(0, comma)), cy: Number(key.slice(comma + 1)) }
}
