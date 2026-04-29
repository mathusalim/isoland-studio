import type { Vec2 } from './types/math.js'

// Convert a screen-space direction vector to isometric tile-space.
//
// Isometric axis mapping (top-down 45° camera):
//   screen up    (0, -1) → tile (-1, -1)  northwest
//   screen down  (0,  1) → tile ( 1,  1)  southeast
//   screen left  (-1, 0) → tile (-1,  1)  southwest
//   screen right ( 1, 0) → tile ( 1, -1)  northeast
//
// Derived transformation: ix = sx + sy,  iy = -sx + sy
// Output is normalized — magnitude is always 0 or 1.
export const screenToIso = (dir: Vec2): Vec2 => {
  const ix = dir.x + dir.y
  const iy = -dir.x + dir.y
  const mag = Math.sqrt(ix * ix + iy * iy)
  if (mag < 0.001) return { x: 0, y: 0 }
  return { x: ix / mag, y: iy / mag }
}
