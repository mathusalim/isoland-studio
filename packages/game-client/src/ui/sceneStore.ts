import { writable } from 'svelte/store'

export type SceneId = 'tiles' | 'spine' | 'multi' | 'bench' | 'collision'

export const SCENE_IDS: SceneId[] = ['tiles', 'spine', 'multi', 'bench', 'collision']

export const SCENE_LABELS: Record<SceneId, string> = {
  tiles: 'Tiles',
  spine: 'Spine',
  multi: 'Multi',
  bench: 'Bench',
  collision: 'Collision',
}

// The currently active scene — updated by sceneSelector.ts on every switch
export const activeScene = writable<SceneId>(SCENE_IDS[0])

// The switch function — set by sceneSelector.ts once scenes are initialised
export const switchSceneFn = writable<(id: SceneId) => void>(() => {})
