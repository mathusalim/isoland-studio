// Exponential lerp smoother — makes 20hz position ticks appear fluid
// Rate ≈ 0.015 per ms means ~95% of the gap is closed in ~200ms, staying snappy without jitter

const RATE = 0.015

export type PositionLerp = {
  x: number
  y: number
  setTarget: (x: number, y: number) => void
  snap: (x: number, y: number) => void
  update: (deltaMs: number) => void
}

export const createPositionLerp = (x: number, y: number): PositionLerp => {
  let cx = x,
    cy = y
  let tx = x,
    ty = y

  return {
    get x() {
      return cx
    },
    get y() {
      return cy
    },
    setTarget(nx, ny) {
      tx = nx
      ty = ny
    },
    snap(nx, ny) {
      cx = nx
      cy = ny
      tx = nx
      ty = ny
    },
    update(deltaMs) {
      const t = 1 - Math.exp(-RATE * deltaMs)
      cx += (tx - cx) * t
      cy += (ty - cy) * t
    },
  }
}
