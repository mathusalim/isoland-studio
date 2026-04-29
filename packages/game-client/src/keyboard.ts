import type { Vec2 } from '@isoland/shared'
import type { KeyMap } from '@isoland/shared'
import { DEFAULT_KEY_MAP, screenToIso } from '@isoland/shared'

export interface KeyboardInput {
  attach(): void
  detach(): void
  getDirection(): Vec2
}

// Returns true if any of the key bindings for an action are currently held
const isHeld = (keys: Set<string>, binding: string | string[]): boolean =>
  Array.isArray(binding) ? binding.some((k) => keys.has(k)) : keys.has(binding)

// Tracks held keys and converts them to a normalized isometric direction.
// Pass a custom keyMap to support rebinding.
export const createKeyboardInput = (keyMap: KeyMap = DEFAULT_KEY_MAP): KeyboardInput => {
  const held = new Set<string>()

  const onKeydown = (e: KeyboardEvent) => {
    if (!e.repeat) held.add(e.key.toLowerCase())
  }

  const onKeyup = (e: KeyboardEvent) => {
    held.delete(e.key.toLowerCase())
  }

  const attach = () => {
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keyup', onKeyup)
  }

  const detach = () => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('keyup', onKeyup)
  }

  const getDirection = (): Vec2 => {
    let sx = 0
    let sy = 0
    if (isHeld(held, keyMap.up)) sy -= 1
    if (isHeld(held, keyMap.down)) sy += 1
    if (isHeld(held, keyMap.left)) sx -= 1
    if (isHeld(held, keyMap.right)) sx += 1
    if (sx === 0 && sy === 0) return { x: 0, y: 0 }
    return screenToIso({ x: sx, y: sy })
  }

  return { attach, detach, getDirection }
}
