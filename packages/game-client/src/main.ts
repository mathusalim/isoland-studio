import './app.css'
import { Application } from 'pixi.js'
import { mount } from 'svelte'
import App from './ui/App.svelte'
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

// Svelte UI overlay — sits above the canvas, pointer-events:none by default
mount(App, { target: document.body })

const game = createGame(app, quality)
game.start()
