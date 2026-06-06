import { defineConfig } from 'vite'
import { resolve } from 'path'
import { writeFileSync, readFileSync } from 'fs'

function emitDeployVersionFile() {
  return {
    name: 'emit-deploy-version-file',
    closeBundle() {
      const payload = JSON.stringify({ v: new Date().toISOString() })
      writeFileSync(resolve(__dirname, 'dist/version.json'), payload)
    },
  }
}

// Emit asset-manifest.json so the service worker can pre-cache only the
// critical student shell assets referenced directly by /index.html. Deferred
// Firebase/runtime chunks stay runtime-cached after first use.
function emitAssetManifest() {
  return {
    name: 'emit-asset-manifest',
    closeBundle() {
      const seen = new Set()
      const assets = []
      const add = (path) => {
        if (!seen.has(path)) {
          seen.add(path)
          assets.push(path)
        }
      }
      try {
        const html = readFileSync(resolve(__dirname, 'dist/index.html'), 'utf8')
        for (const m of html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)) {
          add(m[1])
        }
        const mainJs = html.match(/src="(\/assets\/main-[^"]+\.js)"/)
        if (mainJs) {
          const mainContent = readFileSync(
            resolve(__dirname, 'dist', mainJs[1].replace(/^\//, '')),
            'utf8'
          )
          for (const m of mainContent.matchAll(/"assets\/([^"]+)"/g)) {
            add(`/assets/${m[1]}`)
          }
        }
      } catch (err) {
        console.warn('[emit-asset-manifest] could not read dist/index.html:', err)
      }
      const payload = JSON.stringify({ assets })
      writeFileSync(resolve(__dirname, 'dist/asset-manifest.json'), payload)
    },
  }
}

export default defineConfig({
  build: {
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
      output: {
        // Keep shared utilities (rich-text, event-sessions, etc.) in their own
        // chunk per-entry. Prevents the advisor-portal CSS from being preloaded
        // on the student page just because both pages import rich-text.js.
        manualChunks(id) {
          if (id.includes('vite/preload-helper')) {
            return 'vite-preload'
          }
          if (id.includes('node_modules/firebase')) {
            return 'firebase-vendor'
          }
        },
      },
    },
  },
  plugins: [emitDeployVersionFile(), emitAssetManifest()],
})
