import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte({ preprocess: vitePreprocess() }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Isoland',
        short_name: 'Isoland',
        theme_color: '#1a1a2e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
