import { Application } from 'pixi.js'
import { detectQualityTier, resolutionForTier, antialiasForTier } from './quality/qualityTier.js'
import { createGame } from './game.js'

const quality = detectQualityTier()
console.info(`[quality] tier=${quality.tier} score=${quality.score}`, quality)

const app = new Application()

await app.init({
  resizeTo: window,
  backgroundColor: 0x1a1a2e,
  antialias: antialiasForTier(quality.tier),
  resolution: resolutionForTier(quality.tier),
})

document.body.appendChild(app.canvas)

const game = createGame(app, quality)
game.start()
