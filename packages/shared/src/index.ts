import * as math from './types/math.js'
import * as entity from './types/entity.js'
import * as combat from './types/combat.js'
import * as tile from './types/tile.js'
import * as screen from './types/screen.js'
import * as world from './types/world.js'
import * as chunk from './types/chunk.js'
import * as camera from './types/camera.js'
import * as viewport from './types/viewport.js'

export type { Tile, TileType, Tilemap } from './types/tile.js'
export type { Vec2 } from './types/math.js'

export * as utils from './utils/index.js'
export * as net from './net/index.js'
export * as grid from './grid/index.js'
export const types = {
  math,
  entity,
  combat,
  tile,
  screen,
  world,
  chunk,
  camera,
  viewport,
}
