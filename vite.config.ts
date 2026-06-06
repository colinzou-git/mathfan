import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// VITE_BASE_PATH: set to /mathfan/ when deploying to GitHub Pages project site,
// leave unset (defaults to /) for custom domain or local dev.
const base = process.env.VITE_BASE_PATH ?? '/'
const pkg: { version: string } = JSON.parse(readFileSync('./package.json', 'utf8'))

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(process.env.VITE_GIT_SHA ?? 'dev'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'MathFan',
        short_name: 'MathFan',
        description: 'Adaptive math practice for grades 3–5',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Ensure navigateFallback works under the base path
        navigateFallback: `${base}index.html`,
        // New builds activate immediately instead of sitting in 'waiting'.
        // controllerchange in main.tsx then reloads the page automatically.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
})
