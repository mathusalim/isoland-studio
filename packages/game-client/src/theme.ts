// Reads font CSS custom properties from app.css for use in PixiJS text styles.
const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const FONT_DISPLAY = cssVar('--font-display')
export const FONT_MONO = cssVar('--font-mono')
export const FONT_UI = cssVar('--font-ui')
export const FONT_SERIF = cssVar('--font-serif')
