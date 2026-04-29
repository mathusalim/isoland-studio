import { Container, Graphics } from 'pixi.js'
import type { Vec2 } from '@isoland/shared'
import { screenToIso } from '@isoland/shared'

const RADIUS = 60
const KNOB_RADIUS = Math.round(RADIUS * 0.38)
const DEAD_ZONE = 0.15 // fraction of RADIUS below which input is ignored
const ALPHA_IDLE = 0.3
const ALPHA_ACTIVE = 0.7

// Joystick state machine:
//   HIDDEN  → visible=false, dir={0,0}
//   IDLE    → visible=true, alpha=0.3, no active touch
//   ACTIVE  → visible=true, alpha=0.7, touch held, knob follows finger
type JoystickState = 'hidden' | 'idle' | 'active'

export interface JoystickInput {
  attach(): void
  detach(): void
  // Returns the current normalized isometric direction, or {x:0, y:0} if inactive.
  getDirection(): Vec2
  // Force-hides the joystick (called by InputManager when keyboard is detected).
  hide(): void
  destroy(): void
}

// Renders a virtual joystick on the PixiJS stage and exposes getDirection().
// The joystick only activates for touches in the left half of the canvas.
export const createJoystickInput = (canvas: HTMLCanvasElement, stage: Container): JoystickInput => {
  let state: JoystickState = 'hidden'
  let activeId: number | null = null
  let direction: Vec2 = { x: 0, y: 0 }

  // Build display objects once; only their position changes at runtime
  const container = new Container()
  const baseGfx = new Graphics()
    .circle(0, 0, RADIUS)
    .fill({ color: 0x0d1b2a, alpha: 0.55 })
    .circle(0, 0, RADIUS)
    .stroke({ color: 0x6699bb, width: 2 })
  const knobGfx = new Graphics().circle(0, 0, KNOB_RADIUS).fill(0x6699bb)

  container.addChild(baseGfx, knobGfx)
  container.visible = false
  stage.addChild(container)

  // Convert a DOM Touch to stage-local pixel coordinates, accounting for CSS scaling
  const toLocal = (touch: Touch): Vec2 => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const setState = (next: JoystickState) => {
    if (state === next) return
    state = next
    if (next === 'hidden') {
      container.visible = false
      direction = { x: 0, y: 0 }
    } else if (next === 'idle') {
      container.visible = true
      container.alpha = ALPHA_IDLE
      direction = { x: 0, y: 0 }
      knobGfx.x = 0
      knobGfx.y = 0
    } else {
      container.visible = true
      container.alpha = ALPHA_ACTIVE
    }
  }

  const updateKnob = (touchPos: Vec2) => {
    const dx = touchPos.x - container.x
    const dy = touchPos.y - container.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const clampedDist = Math.min(dist, RADIUS)
    const angle = Math.atan2(dy, dx)

    knobGfx.x = Math.cos(angle) * clampedDist
    knobGfx.y = Math.sin(angle) * clampedDist

    if (dist < DEAD_ZONE * RADIUS) {
      direction = { x: 0, y: 0 }
    } else {
      const sx = Math.cos(angle)
      const sy = Math.sin(angle)
      direction = screenToIso({ x: sx, y: sy })
    }
  }

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    for (const touch of Array.from(e.changedTouches)) {
      const pos = toLocal(touch)
      // Only claim touches in the left half of the canvas
      if (activeId !== null || pos.x >= canvas.width / 2) continue
      activeId = touch.identifier
      container.x = pos.x
      container.y = pos.y
      knobGfx.x = 0
      knobGfx.y = 0
      setState('active')
      direction = { x: 0, y: 0 } // zero until finger moves
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier !== activeId) continue
      updateKnob(toLocal(touch))
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault()
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier !== activeId) continue
      activeId = null
      setState('idle')
    }
  }

  const attach = () => {
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false })
  }

  const detach = () => {
    canvas.removeEventListener('touchstart', onTouchStart)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onTouchEnd)
    canvas.removeEventListener('touchcancel', onTouchEnd)
    activeId = null
    direction = { x: 0, y: 0 }
  }

  const getDirection = (): Vec2 => direction

  const hide = () => {
    activeId = null
    setState('hidden')
  }

  const destroy = () => {
    detach()
    stage.removeChild(container)
    container.destroy({ children: true })
  }

  return { attach, detach, getDirection, hide, destroy }
}
