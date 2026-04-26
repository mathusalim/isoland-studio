import { Assets, Graphics, RenderTexture, Text } from 'pixi.js'
import type { Application } from 'pixi.js'
import { Spine, SpineTexture } from '@esotericsoftware/spine-pixi-v8'
import {
  RegionAttachment,
  Skin,
  TextureAtlasPage,
  TextureAtlasRegion,
} from '@esotericsoftware/spine-pixi-v8'
import type { QualityReport } from '../quality/qualityTier.js'
import type { Scene } from './tilesScene.js'

const SKEL_KEY = 'spineboy-skel'
const ATLAS_KEY = 'spineboy-atlas'
let assetsRegistered = false

// Build a solid-color RegionAttachment — stand-in for a runtime-loaded equipment texture
const makeSolidAttachment = (
  app: Application,
  name: string,
  w: number,
  h: number,
  color: number,
): { attachment: RegionAttachment; rt: RenderTexture } => {
  const gfx = new Graphics().rect(0, 0, w, h).fill(color)
  const rt = RenderTexture.create({ width: w, height: h })
  app.renderer.render({ container: gfx, target: rt })
  gfx.destroy()

  const spineTexture = SpineTexture.from(rt.source)

  const page = new TextureAtlasPage(name)
  page.texture = spineTexture
  page.width = w
  page.height = h

  const region = new TextureAtlasRegion(page, name)
  region.texture = spineTexture
  region.u = 0
  region.v = 0
  region.u2 = 1
  region.v2 = 1
  region.width = w
  region.height = h
  region.originalWidth = w
  region.originalHeight = h
  region.offsetX = 0
  region.offsetY = 0
  region.degrees = 0

  const attachment = new RegionAttachment(name, name)
  attachment.region = region
  attachment.width = w
  attachment.height = h
  attachment.updateRegion()

  return { attachment, rt }
}

// Spine skeletal animation test scene — loads spineboy, press T to swap the gun slot texture
export const createSpineScene = (app: Application, _quality: QualityReport): Scene => {
  let spine: Spine | null = null
  let active = false
  let swapped = false
  let customSkin: Skin | null = null
  let swapRT: RenderTexture | null = null
  let hint: Text | null = null

  const onKeydown = (e: KeyboardEvent) => {
    if (!spine || e.key !== 't') return

    const { skeleton } = spine
    const slot = skeleton.findSlot('gun')
    if (!slot) return

    swapped = !swapped

    if (!swapped) {
      skeleton.setSkin(skeleton.data.defaultSkin)
      return
    }

    if (!customSkin) {
      const { attachment, rt } = makeSolidAttachment(app, 'gun-swap', 105, 102, 0xff2244)
      swapRT = rt

      customSkin = new Skin('custom')
      customSkin.addSkin(skeleton.data.defaultSkin!)
      customSkin.setAttachment(slot.data.index, 'gun', attachment)
    }

    skeleton.setSkin(customSkin)
  }

  const start = () => {
    active = true
    swapped = false
    customSkin = null

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
        text: 'Press T to swap gun slot texture',
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
    swapped = false
    customSkin = null
    window.removeEventListener('keydown', onKeydown)
    hint?.destroy()
    hint = null
    spine?.destroy()
    spine = null
    swapRT?.destroy(true)
    swapRT = null
  }

  return { start, stop }
}
