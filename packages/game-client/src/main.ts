import { Application } from 'pixi.js'
import { Game } from './game.js'

const app = new Application()

await app.init({
  resizeTo: window,
  backgroundColor: 0x1a1a2e,
  antialias: true,
})

document.body.appendChild(app.canvas)

const game = new Game(app)
game.start()
