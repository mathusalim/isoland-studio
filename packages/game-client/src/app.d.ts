import type { Component } from 'svelte'

// Allow TypeScript to resolve *.svelte imports; Vite handles actual compilation
declare module '*.svelte' {
  const component: Component
  export default component
}
