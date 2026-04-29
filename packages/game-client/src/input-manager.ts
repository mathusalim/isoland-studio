import type { Application } from 'pixi.js'
import type { Vec2 } from '@isoland/shared'
import type { KeyMap } from '@isoland/shared'
import type { movement } from '@isoland/shared'
import { createKeyboardInput } from './keyboard.js'
import { createJoystickInput } from './joystick.js'

export interface InputManager {
  attach(): void
  detach(): void
  // Call once per game tick. Returns a PlayerInput if direction changed since the last call,
  // null if it is identical. Also fires onInput when a new input is produced.
  poll(seq: number, timestamp: number): movement.PlayerInput | null
  // Attach a listener that receives every non-null input produced by poll().
  // Intended for wiring to the prediction buffer.
  onInput: ((input: movement.PlayerInput) => void) | null
  destroy(): void
}

const eqDir = (a: Vec2, b: Vec2): boolean =>
  Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001

// Wires keyboard and touch-joystick into a single polling interface.
// Last-input-wins: the source whose direction most recently changed takes priority.
// When a keyboard key is pressed the joystick is hidden to keep the UI clean.
export const createInputManager = (app: Application, keyMap?: KeyMap): InputManager => {
  const canvas = app.canvas as HTMLCanvasElement
  const keyboard = createKeyboardInput(keyMap)
  const joystick = createJoystickInput(canvas, app.stage)

  let lastDir: Vec2 = { x: 0, y: 0 }
  let lastPollTs = 0
  let activeSource: 'keyboard' | 'joystick' = 'keyboard'

  // When the user presses a key, switch to keyboard and hide the joystick overlay
  const onKeyActivity = () => {
    activeSource = 'keyboard'
    joystick.hide()
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

    // Joystick direction non-zero means it's actively being touched — promote it
    const joyDir = joystick.getDirection()
    if (joyDir.x !== 0 || joyDir.y !== 0) activeSource = 'joystick'

    const dir = activeSource === 'joystick' ? joyDir : keyboard.getDirection()

    if (eqDir(dir, lastDir)) return null
    lastDir = { ...dir }

    const input: movement.PlayerInput = { seq, direction: dir, dt, timestamp }
    onInput?.(input)
    return input
  }

  const destroy = () => {
    detach()
    joystick.destroy()
  }

  const manager: InputManager = { attach, detach, poll, onInput: null, destroy }

  // Expose onInput as a settable property by returning a proxy-like object.
  // Using Object.defineProperty so onInput assignment flows through to the closure.
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
