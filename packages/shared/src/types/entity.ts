import type { Vec2 } from './math.js'

export interface Entity {
  id: string
  position: Vec2
  velocity: Vec2
}

export interface PlayerEntity extends Entity {
  name: string
  characterId: string
}
