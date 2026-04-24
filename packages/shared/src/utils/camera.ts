// worldToViewport(worldX, worldY, cameraX, cameraY) → {x, y} — world-space to PixiJS stage coords
// viewportToWorld(vpX, vpY, cameraX, cameraY) → {x, y} — inverse, for click-to-move
// getTilesInViewport(cameraX, cameraY, screenW, screenH, tileW, tileH) → TileCoord[] — culling, only render visible tiles

import { Camera } from '../types/camera'
import { Viewport } from '../types/viewport'
import { WorldPosition } from '../types/world'

// worldToViewport — converts a world position to a viewport position, accounting for camera position and zoom
export const worldToViewport = (world: WorldPosition, camera: Camera): Viewport => {
  return {
    x: (world.x - camera.x) * camera.zoom,
    y: (world.y - camera.y) * camera.zoom,
  }
}

// viewportToWorld — converts a viewport position to a world position, accounting for camera position and zoom
export const viewportToWorld = (vp: Viewport, camera: Camera): WorldPosition => {
  return {
    x: vp.x / camera.zoom + camera.x,
    y: vp.y / camera.zoom + camera.y,
    z: camera.z,
  }
}
