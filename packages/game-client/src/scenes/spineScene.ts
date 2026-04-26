import { Assets, Graphics, RenderTexture, Text } from 'pixi.js'
import type { Application } from 'pixi.js'
import { Spine, SpineTexture } from '@esotericsoftware/spine-pixi-v8'
import { TextureAtlas } from '@esotericsoftware/spine-pixi-v8'
import type { QualityReport } from '../quality/qualityTier.js'
import type { Scene } from './tilesScene.js'

const SKEL_KEY = 'spineboy-skel'
const ATLAS_KEY = 'spineboy-atlas'
// spineboy atlas dimensions — replacement must match so UV regions land correctly
const ATLAS_W = 1024
const ATLAS_H = 256

let assetsRegistered = false
// Kept alive across scene restarts — created once, reused
let checkerRT: RenderTexture | null = null

// 32-px checkerboard at atlas dimensions — reveals UV mapping and mesh deformation immediately
const buildCheckerRT = (app: Application): RenderTexture => {
  const cell = 32
  const gfx = new Graphics()
  for (let row = 0; row < ATLAS_H / cell; row++) {
    for (let col = 0; col < ATLAS_W / cell; col++) {
      gfx.rect(col * cell, row * cell, cell, cell).fill((col + row) % 2 === 0 ? 0xeeeeee : 0xff0077)
    }
  }
  const rt = RenderTexture.create({ width: ATLAS_W, height: ATLAS_H })
  app.renderer.render({ container: gfx, target: rt })
  gfx.destroy()
  return rt
}

// Spine full-atlas texture swap demo — validates that runtime texture injection works on a live rig
export const createSpineScene = (app: Application, _quality: QualityReport): Scene => {
  let spine: Spine | null = null
  let active = false
  let swapped = false
  let originalTexture: SpineTexture | null = null
  let hint: Text | null = null

  const swapAtlasPage = (toChecker: boolean) => {
    const atlas = Assets.get<TextureAtlas>(ATLAS_KEY)
    const page = atlas.pages[0]

    if (toChecker) {
      if (!originalTexture) originalTexture = page.texture as SpineTexture
      if (!checkerRT) checkerRT = buildCheckerRT(app)
      page.setTexture(SpineTexture.from(checkerRT.source))
    } else if (originalTexture) {
      page.setTexture(originalTexture)
    }
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (!spine || e.key !== 't') return
    swapped = !swapped
    swapAtlasPage(swapped)
  }

  const start = () => {
    active = true
    swapped = false

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

      hint = new Text({
        text: 'T — swap entire atlas texture (checkerboard reveals UV mapping)',
        style: { fill: 0xffffff, fontSize: 14, fontFamily: 'monospace' },
      })
      hint.x = 12
      hint.y = app.screen.height - 30
      app.stage.addChild(hint)
    })

    window.addEventListener('keydown', onKeydown)
  }

  const stop = () => {
    active = false
    // Restore the atlas page so the cached TextureAtlas is clean for next start
    if (swapped) swapAtlasPage(false)
    swapped = false
    originalTexture = null
    window.removeEventListener('keydown', onKeydown)
    hint?.destroy()
    hint = null
    spine?.destroy()
    spine = null
  }

  return { start, stop }
}
