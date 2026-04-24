import { Application } from 'pixi.js'
import { createGame } from './game.js'

const app = new Application()

await app.init({
  resizeTo: window,
  backgroundColor: 0x1a1a2e,
  antialias: true,
})

document.body.appendChild(app.canvas)

const game = createGame(app)
game.start()
