import type { Application } from 'pixi.js'
import type { QualityReport } from './quality/qualityTier.js'
import { createSceneSelector } from './sceneSelector.js'

export type Game = {
  start: () => void
  stop: () => void
}

// Entry point — delegates to the scene selector
export const createGame = (app: Application, quality: QualityReport): Game => {
  const selector = createSceneSelector(app, quality)
  return { start: selector.start, stop: selector.stop }
}
