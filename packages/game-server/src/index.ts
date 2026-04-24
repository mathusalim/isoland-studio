import uWS from 'uWebSockets.js'
import type { PlayerEntity } from '@isoland/shared'

const PORT = Number(process.env.PORT ?? 9001)
const TICK_RATE = 20
const TICK_MS = 1000 / TICK_RATE

const players = new Map<string, PlayerEntity>()

uWS
  .App()
  .ws<{ id: string }>('/*', {
    open(ws) {
      const id = crypto.randomUUID()
      ws.getUserData().id = id
      players.set(id, {
        id,
        name: 'unknown',
        characterId: '',
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
      })
      console.log(`[game-server] connected: ${id}`)
    },
    message(_ws, _message, _isBinary) {
      // handle client messages
    },
    close(ws) {
      const { id } = ws.getUserData()
      players.delete(id)
      console.log(`[game-server] disconnected: ${id}`)
    },
  })
  .listen(PORT, (token) => {
    if (token) console.log(`[game-server] :${PORT} @ ${TICK_RATE}hz`)
    else console.error(`[game-server] failed to listen on :${PORT}`)
  })

setInterval(tick, TICK_MS)

function tick() {
  // broadcast world state snapshot to all players
}
