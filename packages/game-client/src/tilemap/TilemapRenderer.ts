import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import { utils } from '@isoland/shared'
import type { Tilemap, TileType } from '@isoland/shared'
import { TILE_COLORS } from './tileTextures.js'

export type TilemapRenderer = {
  container: Container
  destroy: () => void
}

const darken = (color: number, factor: number): number => {
  const r = Math.floor(((color >> 16) & 0xff) * factor)
  const g = Math.floor(((color >> 8) & 0xff) * factor)
  const b = Math.floor((color & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}

// Renders a static isometric tilemap with elevation wall faces
export const createTilemapRenderer = (
  parent: Container,
  map: Tilemap,
  tileWidth: number,
  tileHeight: number,
  textures: Map<TileType, Texture>,
): TilemapRenderer => {
  const container = new Container()
  container.sortableChildren = true

  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.columns; x++) {
      const type = utils.tilemap.getTile(map, x, y)
      if (!type) continue
      const texture = textures.get(type)
      if (!texture) continue

      const elevation = utils.tilemap.getElevation(map, x, y) ?? 0
      const pos = utils.coordinateConversion.worldToScreen(
        { x, y, z: elevation },
        { x, y, width: tileWidth, height: tileHeight },
      )
      const depth = utils.depth.tileDepth({ x, y, width: tileWidth, height: tileHeight }, elevation)

      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5, 0)
      sprite.x = pos.x
      sprite.y = pos.y
      sprite.zIndex = depth
      container.addChild(sprite)

      // SE wall face — right edge of diamond, drops towards x+1
      const seElev = utils.tilemap.getElevation(map, x + 1, y) ?? 0
      if (elevation > seElev) {
        const wallH = (elevation - seElev) * tileHeight
        const wall = new Graphics()
          .moveTo(pos.x + tileWidth / 2, pos.y + tileHeight / 2)
          .lineTo(pos.x, pos.y + tileHeight)
          .lineTo(pos.x, pos.y + tileHeight + wallH)
          .lineTo(pos.x + tileWidth / 2, pos.y + tileHeight / 2 + wallH)
          .closePath()
          .fill(darken(TILE_COLORS[type], 0.65))
        wall.zIndex = depth + 0.5
        container.addChild(wall)
      }

      // SW wall face — left edge of diamond, drops towards y+1
      const swElev = utils.tilemap.getElevation(map, x, y + 1) ?? 0
      if (elevation > swElev) {
        const wallH = (elevation - swElev) * tileHeight
        const wall = new Graphics()
          .moveTo(pos.x, pos.y + tileHeight)
          .lineTo(pos.x - tileWidth / 2, pos.y + tileHeight / 2)
          .lineTo(pos.x - tileWidth / 2, pos.y + tileHeight / 2 + wallH)
          .lineTo(pos.x, pos.y + tileHeight + wallH)
          .closePath()
          .fill(darken(TILE_COLORS[type], 0.45))
        wall.zIndex = depth + 0.5
        container.addChild(wall)
      }
    }
  }

  parent.addChild(container)

  return {
    container,
    destroy: () => container.destroy({ children: true }),
  }
}
