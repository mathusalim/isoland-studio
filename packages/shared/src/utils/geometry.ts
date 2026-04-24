import { ScreenPosition } from '../types/screen'
import { Tile } from '../types/tile'

//the raw 2×2 matrix transform (everything else composes on top of this)
export const cartesianToIso = (x: number, y: number) => {
  return {
    isoX: x - y,
    isoY: (x + y) / 2,
  }
}

// inverse matrix transform
export const isoToCartesian = (isoX: number, isoY: number) => {
  return {
    x: isoX + isoY,
    y: isoX - isoY,
  }
}

// rounds a screen coord to nearest tile (mouse hover highlight)
export const snapToTile = (screen: ScreenPosition) => {
  return {
    tileX: Math.round(screen.x),
    tileY: Math.round(screen.y),
  }
}

// smooth movement interpolation between tiles
export const lerpTile = (a: Tile, b: Tile, t: number) => {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  }
}
