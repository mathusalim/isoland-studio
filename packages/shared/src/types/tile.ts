export type Tile = {
  x: number
  y: number
  width: number
  height: number
}

export type TileType = 'grass' | 'stone' | 'water' | 'sand'

export type Tilemap = {
  columns: number
  rows: number
  cells: TileType[]
}
