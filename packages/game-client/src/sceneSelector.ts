import type { Application } from 'pixi.js'
import type { QualityReport } from './quality/qualityTier.js'
import { createTilesScene } from './scenes/tilesScene.js'
import { createSpineScene } from './scenes/spineScene.js'
import type { Scene } from './scenes/tilesScene.js'

type SceneId = 'tiles' | 'spine'

export type SceneSelector = {
  start: () => void
  stop: () => void
}

// Dev scene selector — floating button panel, not for production
export const createSceneSelector = (app: Application, quality: QualityReport): SceneSelector => {
  const scenes: Record<SceneId, Scene> = {
    tiles: createTilesScene(app, quality),
    spine: createSpineScene(app, quality),
  }

  const labels: Record<SceneId, string> = {
    tiles: 'Tiles',
    spine: 'Spine',
  }

  let currentId: SceneId = 'tiles'

  // --- DOM panel ---
  const panel = document.createElement('div')
  panel.style.cssText = [
    'position:fixed', 'top:12px', 'left:12px', 'z-index:9999',
    'display:flex', 'align-items:center', 'gap:6px',
    'font-family:monospace', 'font-size:12px',
  ].join(';')

  const devLabel = document.createElement('span')
  devLabel.textContent = 'DEV'
  devLabel.style.cssText = 'color:rgba(255,220,50,0.9);letter-spacing:1px;margin-right:2px'
  panel.appendChild(devLabel)

  const buttons: Partial<Record<SceneId, HTMLButtonElement>> = {}

  const baseBtn = [
    'padding:5px 14px', 'border:1px solid rgba(255,255,255,0.25)',
    'background:rgba(0,0,0,0.55)', 'color:#fff', 'cursor:pointer',
    'border-radius:4px', 'font-family:monospace', 'font-size:12px',
  ].join(';')

  const activeBtn = [
    'padding:5px 14px', 'border:1px solid rgba(255,255,255,0.85)',
    'background:rgba(255,255,255,0.18)', 'color:#fff', 'cursor:pointer',
    'border-radius:4px', 'font-family:monospace', 'font-size:12px',
  ].join(';')

  const updateButtons = () => {
    for (const [id, btn] of Object.entries(buttons) as [SceneId, HTMLButtonElement][]) {
      btn.style.cssText = id === currentId ? activeBtn : baseBtn
    }
  }

  const switchTo = (id: SceneId) => {
    if (id === currentId) return
    scenes[currentId].stop()
    currentId = id
    scenes[currentId].start()
    updateButtons()
  }

  for (const id of Object.keys(scenes) as SceneId[]) {
    const btn = document.createElement('button')
    btn.textContent = labels[id]
    btn.style.cssText = baseBtn
    btn.addEventListener('click', () => switchTo(id))
    panel.appendChild(btn)
    buttons[id] = btn
  }

  updateButtons()

  const start = () => {
    document.body.appendChild(panel)
    scenes[currentId].start()
  }

  const stop = () => {
    scenes[currentId].stop()
    panel.remove()
  }

  return { start, stop }
}
