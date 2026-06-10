import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// VITE_BASE_PATH: set to /mathfan/ when deploying to GitHub Pages project site,
// leave unset (defaults to /) for custom domain or local dev.
const base = process.env.VITE_BASE_PATH ?? '/'
const pkg: { version: string } = JSON.parse(readFileSync('./package.json', 'utf8'))

// Computed once so the values baked into the bundle (via `define`) and the
// values written to build-info.json are guaranteed to match. The update checker
// in Settings compares these two to decide whether a newer build is deployed.
const appVersion = pkg.version
const gitSha = process.env.VITE_GIT_SHA ?? 'dev'
const buildTime = new Date().toISOString()

// Emits /build-info.json into dist and serves the same payload in dev, so the
// "Check for Updates" button can probe the deployed build over the network.
// build-info.json is intentionally NOT in the Workbox precache globs, so the
// service worker never serves a stale copy — the fetch always hits the network.
function buildInfoPlugin(): Plugin {
  const payload = JSON.stringify({ appVersion, gitSha, buildTime }, null, 2)
  return {
    name: 'mathfan-build-info',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split('?')[0].endsWith('/build-info.json')) {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(payload)
          return
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: payload })
    },
  }
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_SHA__: JSON.stringify(gitSha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    buildInfoPlugin(),
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
