import { Assets } from 'pixi.js'
import type { Application } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import type { QualityReport } from '../quality/qualityTier.js'
import type { Scene } from './tilesScene.js'

const SKEL_KEY = 'spineboy-skel'
const ATLAS_KEY = 'spineboy-atlas'
let assetsRegistered = false

// Spine skeletal animation test scene — loads spineboy and plays the walk animation
export const createSpineScene = (app: Application, _quality: QualityReport): Scene => {
  let spine: Spine | null = null
  let active = false

  const start = () => {
    active = true

    if (!assetsRegistered) {
      Assets.add({ alias: SKEL_KEY, src: '/spine/spineboy/spineboy-pro.skel' })
      Assets.add({ alias: ATLAS_KEY, src: '/spine/spineboy/spineboy-pma.atlas' })
      assetsRegistered = true
    }

    Assets.load([SKEL_KEY, ATLAS_KEY]).then(() => {
      if (!active) return

      spine = Spine.from({ skeleton: SKEL_KEY, atlas: ATLAS_KEY, scale: 0.5 })
      spine.x = app.screen.width / 2
      spine.y = app.screen.height * 0.75
      spine.state.setAnimation(0, 'walk', true)
      app.stage.addChild(spine)
    })
  }

  const stop = () => {
    active = false
    spine?.destroy()
    spine = null
  }

  return { start, stop }
}
