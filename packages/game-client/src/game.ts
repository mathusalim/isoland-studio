import type { Application, Ticker } from 'pixi.js'

export class Game {
  private app: Application

  constructor(app: Application) {
    this.app = app
  }

  start() {
    this.app.ticker.add(this.tick, this)
  }

  stop() {
    this.app.ticker.remove(this.tick, this)
  }

  private tick(_ticker: Ticker) {
    // game loop — update world state here
  }
}
