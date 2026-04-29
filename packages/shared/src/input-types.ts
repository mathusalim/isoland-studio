// Key binding configuration — each action accepts one or more key strings (e.key.toLowerCase())
export interface KeyMap {
  up: string | string[]
  down: string | string[]
  left: string | string[]
  right: string | string[]
}

// Default WASD + arrow key bindings
export const DEFAULT_KEY_MAP: KeyMap = {
  up: ['w', 'arrowup'],
  down: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
}
