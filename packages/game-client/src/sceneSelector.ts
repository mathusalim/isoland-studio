import type { Application } from 'pixi.js'
import type { QualityReport } from './quality/qualityTier.js'
import { createTilesScene } from './scenes/tilesScene.js'
import { createSpineScene } from './scenes/spineScene.js'
import { createMultiScene } from './scenes/multiScene.js'
import { createBenchmarkScene } from './scenes/benchmarkScene.js'
import { createCollisionScene } from './scenes/collisionScene.js'
import type { Scene } from './scenes/tilesScene.js'
import { SCENE_IDS, activeScene, switchSceneFn } from './ui/sceneStore.js'
import type { SceneId } from './ui/sceneStore.js'

export type SceneSelector = {
  start: () => void
  stop: () => void
}

// Manages scene lifecycle and wires the Svelte scene store
export const createSceneSelector = (app: Application, quality: QualityReport): SceneSelector => {
  const scenes: Record<SceneId, Scene> = {
    tiles: createTilesScene(app, quality),
    spine: createSpineScene(app, quality),
    multi: createMultiScene(app, quality),
    bench: createBenchmarkScene(app, quality),
    collision: createCollisionScene(app, quality),
  }

  let currentId: SceneId = SCENE_IDS[0]

  const switchTo = (id: SceneId): void => {
    if (id === currentId) return
    scenes[currentId].stop()
    currentId = id
    scenes[currentId].start()
    activeScene.set(id)
  }

  const start = (): void => {
    switchSceneFn.set(switchTo)
    activeScene.set(currentId)
    scenes[currentId].start()
  }

  const stop = (): void => {
    scenes[currentId].stop()
  }

  return { start, stop }
}
