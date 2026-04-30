import type { Application } from 'pixi.js'
import type { Vec2 } from '@isoland/shared'
import type { KeyMap } from '@isoland/shared'
import type { movement } from '@isoland/shared'
import { createKeyboardInput } from './keyboard.js'
import { createJoystickInput } from './joystick.js'

export interface InputManager {
  attach(): void
  detach(): void
  // Call once per game tick. Returns a PlayerInput if direction or dodge changed since
  // the last call, null if identical. Also fires onInput when a new input is produced.
  poll(seq: number, timestamp: number): movement.PlayerInput | null
  // Attach a listener that receives every non-null input produced by poll().
  onInput: ((input: movement.PlayerInput) => void) | null
  // Called by the mobile dodge button to queue a one-shot dodge.
  triggerDodge(): void
  destroy(): void
}

const eqDir = (a: Vec2, b: Vec2): boolean =>
  Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001

// Wires keyboard and touch-joystick into a single polling interface.
// Dodge is a one-shot flag: set on Space keydown (or triggerDodge()), cleared after one poll().
export const createInputManager = (app: Application, keyMap?: KeyMap): InputManager => {
  const canvas = app.canvas as HTMLCanvasElement
  const keyboard = createKeyboardInput(keyMap)
  const joystick = createJoystickInput(canvas, app.stage)

  let lastDir: Vec2 = { x: 0, y: 0 }
  let lastPollTs = 0
  let activeSource: 'keyboard' | 'joystick' = 'keyboard'
  let dodgePressed = false

  const onKeyActivity = (e: KeyboardEvent) => {
    activeSource = 'keyboard'
    joystick.hide()
    if (e.key === ' ' && !e.repeat) dodgePressed = true
  }

  let onInput: ((input: movement.PlayerInput) => void) | null = null

  const attach = () => {
    keyboard.attach()
    joystick.attach()
    window.addEventListener('keydown', onKeyActivity)
  }

  const detach = () => {
    keyboard.detach()
    joystick.detach()
    window.removeEventListener('keydown', onKeyActivity)
  }

  const poll = (seq: number, timestamp: number): movement.PlayerInput | null => {
    const dt = lastPollTs > 0 ? (timestamp - lastPollTs) / 1000 : 0
    lastPollTs = timestamp

    const joyDir = joystick.getDirection()
    if (joyDir.x !== 0 || joyDir.y !== 0) activeSource = 'joystick'

    const dir = activeSource === 'joystick' ? joyDir : keyboard.getDirection()

    // Consume the one-shot flag regardless of whether we emit an input
    const thisDodge = dodgePressed
    dodgePressed = false

    // Emit an input only when something changed
    if (eqDir(dir, lastDir) && !thisDodge) return null
    lastDir = { ...dir }

    const input: movement.PlayerInput = { seq, direction: dir, dt, timestamp, dodge: thisDodge }
    onInput?.(input)
    return input
  }

  const triggerDodge = (): void => {
    dodgePressed = true
  }

  const destroy = () => {
    detach()
    joystick.destroy()
  }

  const manager: InputManager = {
    attach,
    detach,
    poll,
    onInput: null,
    triggerDodge,
    destroy,
  }

  Object.defineProperty(manager, 'onInput', {
    get: () => onInput,
    set: (cb: ((input: movement.PlayerInput) => void) | null) => {
      onInput = cb
    },
    enumerable: true,
    configurable: true,
  })

  return manager
}
