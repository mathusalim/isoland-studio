import { Container, Sprite, type Texture } from 'pixi.js'
import { utils } from '@isoland/shared'
import type { Tilemap, TileType } from '@isoland/shared'

export type TilemapRenderer = {
  container: Container
  destroy: () => void
}

// Renders a static isometric tilemap sorted by painter's algorithm depth
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

      const pos = utils.coordinateConversion.tileToScreen({
        x,
        y,
        width: tileWidth,
        height: tileHeight,
      })
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5, 0)
      sprite.x = pos.x
      sprite.y = pos.y
      sprite.zIndex = utils.depth.tileDepth({ x, y, width: tileWidth, height: tileHeight })
      container.addChild(sprite)
    }
  }

  parent.addChild(container)

  return {
    container,
    destroy: () => container.destroy({ children: true }),
  }
}
