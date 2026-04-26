import { Container } from 'pixi.js'
import type { Application } from 'pixi.js'

export type CameraMode = 'free' | 'follow' | 'cinematic'

// Required — describes the map so the camera can clamp to its bounds
export type CameraMapConfig = {
  mapColumns: number
  mapRows: number
  tileWidth: number
  tileHeight: number
}

// Optional tuning — all have sensible defaults
export type CameraOptions = {
  minZoom?: number
  maxZoom?: number
  zoomSpeed?: number // zoom factor change per scroll tick (0–1)
  keyPanSpeed?: number // world-px per second
  edgeScrollSpeed?: number // world-px per second
  edgeScrollMargin?: number // screen-px trigger band at each edge
  deadzoneRadius?: number // screen-px deadzone before follow activates
  followLerp?: number // exponential rate — higher = snappier (8 ≈ smooth)
  followOffset?: { x: number; y: number } // world-px offset added to follow target
}

export type Camera = {
  // All world objects go into this container; UI lives on app.stage directly
  worldContainer: Container
  // Mode control
  setMode: (mode: CameraMode) => void
  // Point the follow system at a live position getter; also switches to follow mode
  setFollowTarget: (getPos: () => { x: number; y: number }) => void
  // Scripted camera move; switches to cinematic mode, returns to follow on arrival
  moveTo: (x: number, y: number, duration?: number, onComplete?: () => void) => void
  // Layered shake — stacks, decays quadratically, does not disturb base position
  shake: (intensity: number, duration: number, angle?: number) => void
  // Coordinate queries used by targeting, HUD anchors, culling
  worldToScreen: (wx: number, wy: number) => { x: number; y: number }
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  isVisible: (wx: number, wy: number, margin?: number) => boolean
  // Called every tick with deltaMS from PixiJS ticker
  update: (deltaMs: number) => void
  destroy: () => void
}

type ShakeState = {
  intensity: number
  duration: number
  elapsed: number
  angle: number
}

// Creates the camera system and attaches worldContainer to app.stage
export const createCamera = (
  app: Application,
  mapCfg: CameraMapConfig,
  options: CameraOptions = {},
): Camera => {
  const minZoom = options.minZoom ?? 0.25
  const maxZoom = options.maxZoom ?? 2
  const zoomSpeed = options.zoomSpeed ?? 0.15
  const keyPanSpeed = options.keyPanSpeed ?? 400
  const edgeScrollSpeed = options.edgeScrollSpeed ?? 300
  const edgeScrollMargin = options.edgeScrollMargin ?? 60
  const deadzoneRadius = options.deadzoneRadius ?? 80
  const followLerp = options.followLerp ?? 8
  const followOffset = options.followOffset ?? { x: 0, y: 0 }

  // Actual pixel extents of all tile sprites in world-screen space.
  // Left vertex of tile (0, rows-1) and right vertex of tile (columns-1, 0),
  // bottom vertex of tile (columns-1, rows-1).
  const mapMinX = -(mapCfg.mapRows * mapCfg.tileWidth) / 2
  const mapMaxX = (mapCfg.mapColumns * mapCfg.tileWidth) / 2
  const mapMinY = 0
  const mapMaxY =
    ((mapCfg.mapColumns + mapCfg.mapRows - 2) * mapCfg.tileHeight) / 2 + mapCfg.tileHeight

  const worldContainer = new Container()
  app.stage.addChild(worldContainer)

  // --- Mutable state ---
  let mode: CameraMode = 'follow'
  const position = { x: (mapMinX + mapMaxX) / 2, y: (mapMinY + mapMaxY) / 2 }
  let zoom = 1
  let followTarget: (() => { x: number; y: number }) | null = null
  let cinematicTarget: { x: number; y: number } | null = null
  let cinematicLerpSpeed = 4
  let cinematicOnComplete: (() => void) | null = null
  let shakes: ShakeState[] = []
  const keysDown = new Set<string>()
  const mouseScreen = { x: app.screen.width / 2, y: app.screen.height / 2 }
  let drag: { startSx: number; startSy: number; startCx: number; startCy: number } | null = null

  // --- Helpers ---

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  const clampToBounds = () => {
    const hw = app.screen.width / (2 * zoom)
    const hh = app.screen.height / (2 * zoom)
    position.x =
      (mapMaxX - mapMinX) * zoom > app.screen.width
        ? clamp(position.x, mapMinX + hw, mapMaxX - hw)
        : (mapMinX + mapMaxX) / 2
    position.y =
      (mapMaxY - mapMinY) * zoom > app.screen.height
        ? clamp(position.y, mapMinY + hh, mapMaxY - hh)
        : (mapMinY + mapMaxY) / 2
  }

  const applyTransform = (shakeX = 0, shakeY = 0) => {
    worldContainer.x = Math.round(app.screen.width / 2 - position.x * zoom + shakeX)
    worldContainer.y = Math.round(app.screen.height / 2 - position.y * zoom + shakeY)
    worldContainer.scale.set(zoom)
  }

  // --- Input handlers ---

  const onKeyDown = (e: KeyboardEvent) => keysDown.add(e.code)
  const onKeyUp = (e: KeyboardEvent) => keysDown.delete(e.code)

  const onPointerMove = (e: PointerEvent) => {
    mouseScreen.x = e.clientX
    mouseScreen.y = e.clientY
    if (drag) {
      position.x = drag.startCx - (e.clientX - drag.startSx) / zoom
      position.y = drag.startCy - (e.clientY - drag.startSy) / zoom
      mode = 'free'
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      drag = { startSx: e.clientX, startSy: e.clientY, startCx: position.x, startCy: position.y }
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    if (e.button === 1) drag = null
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const prevZoom = zoom
    zoom = clamp(prevZoom * (1 + -Math.sign(e.deltaY) * zoomSpeed), minZoom, maxZoom)
    // Keep the world point under the cursor stationary as zoom changes
    position.x += (e.clientX - app.screen.width / 2) * (1 / prevZoom - 1 / zoom)
    position.y += (e.clientY - app.screen.height / 2) * (1 / prevZoom - 1 / zoom)
    clampToBounds()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('wheel', onWheel, { passive: false })

  // --- Update ---

  const update = (deltaMs: number) => {
    const dt = deltaMs / 1000

    // Keyboard and edge-scroll pan — active in free and follow modes
    if (mode !== 'cinematic') {
      let panX = 0
      let panY = 0

      if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) panY -= keyPanSpeed * dt
      if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) panY += keyPanSpeed * dt
      if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) panX -= keyPanSpeed * dt
      if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) panX += keyPanSpeed * dt

      if (!drag) {
        const sw = app.screen.width
        const sh = app.screen.height
        if (mouseScreen.x < edgeScrollMargin)
          panX -= edgeScrollSpeed * dt * (1 - mouseScreen.x / edgeScrollMargin)
        if (mouseScreen.x > sw - edgeScrollMargin)
          panX += edgeScrollSpeed * dt * (1 - (sw - mouseScreen.x) / edgeScrollMargin)
        if (mouseScreen.y < edgeScrollMargin)
          panY -= edgeScrollSpeed * dt * (1 - mouseScreen.y / edgeScrollMargin)
        if (mouseScreen.y > sh - edgeScrollMargin)
          panY += edgeScrollSpeed * dt * (1 - (sh - mouseScreen.y) / edgeScrollMargin)
      }

      if (panX !== 0 || panY !== 0) {
        position.x += panX
        position.y += panY
        mode = 'free'
      }
    }

    // Soft follow — deadzone in screen-px, frame-rate-independent lerp
    if (mode === 'follow' && followTarget) {
      const t = followTarget()
      const tx = t.x + followOffset.x
      const ty = t.y + followOffset.y
      const sdx = (tx - position.x) * zoom
      const sdy = (ty - position.y) * zoom
      if (sdx * sdx + sdy * sdy > deadzoneRadius * deadzoneRadius) {
        const alpha = 1 - Math.exp(-followLerp * dt)
        position.x += (tx - position.x) * alpha
        position.y += (ty - position.y) * alpha
      }
    }

    // Cinematic — lerp to target, fire callback on arrival, return to follow
    if (mode === 'cinematic' && cinematicTarget) {
      const alpha = 1 - Math.exp(-cinematicLerpSpeed * dt)
      position.x += (cinematicTarget.x - position.x) * alpha
      position.y += (cinematicTarget.y - position.y) * alpha
      const dx = cinematicTarget.x - position.x
      const dy = cinematicTarget.y - position.y
      if (dx * dx + dy * dy < 1) {
        position.x = cinematicTarget.x
        position.y = cinematicTarget.y
        cinematicOnComplete?.()
        cinematicTarget = null
        mode = 'follow'
      }
    }

    clampToBounds()

    // Shake — quadratic decay, directional, stacks
    let shakeX = 0
    let shakeY = 0
    shakes = shakes.filter((s) => {
      s.elapsed += deltaMs
      return s.elapsed < s.duration
    })
    for (const s of shakes) {
      const t = 1 - s.elapsed / s.duration
      const amt = s.intensity * t * t
      const a = s.angle + (Math.random() - 0.5) * Math.PI
      shakeX += Math.cos(a) * amt * (Math.random() * 2 - 1)
      shakeY += Math.sin(a) * amt * (Math.random() * 2 - 1)
    }

    applyTransform(shakeX, shakeY)
  }

  // --- Public API ---

  const worldToScreen = (wx: number, wy: number) => ({
    x: (wx - position.x) * zoom + app.screen.width / 2,
    y: (wy - position.y) * zoom + app.screen.height / 2,
  })

  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - app.screen.width / 2) / zoom + position.x,
    y: (sy - app.screen.height / 2) / zoom + position.y,
  })

  const isVisible = (wx: number, wy: number, margin = 0) => {
    const s = worldToScreen(wx, wy)
    return (
      s.x >= -margin &&
      s.x <= app.screen.width + margin &&
      s.y >= -margin &&
      s.y <= app.screen.height + margin
    )
  }

  const setMode = (m: CameraMode) => {
    mode = m
  }

  const setFollowTarget = (getPos: () => { x: number; y: number }) => {
    followTarget = getPos
    mode = 'follow'
  }

  const moveTo = (x: number, y: number, duration = 1, onComplete?: () => void) => {
    cinematicTarget = { x, y }
    cinematicLerpSpeed = 4 / duration
    cinematicOnComplete = onComplete ?? null
    mode = 'cinematic'
  }

  const shake = (intensity: number, duration: number, angle?: number) => {
    shakes.push({ intensity, duration, elapsed: 0, angle: angle ?? Math.random() * Math.PI * 2 })
  }

  const destroy = () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('wheel', onWheel)
    worldContainer.destroy({ children: true })
  }

  applyTransform()

  return {
    worldContainer,
    setMode,
    setFollowTarget,
    moveTo,
    shake,
    worldToScreen,
    screenToWorld,
    isVisible,
    update,
    destroy,
  }
}
