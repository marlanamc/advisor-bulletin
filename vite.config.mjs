import { defineConfig } from 'vite'
import { resolve } from 'path'
import { writeFileSync, readFileSync, readdirSync } from 'fs'

const rootDir = import.meta.dirname

function emitDeployVersionFile() {
  return {
    name: 'emit-deploy-version-file',
    closeBundle() {
      const payload = JSON.stringify({ v: new Date().toISOString() })
      writeFileSync(resolve(rootDir, 'dist/version.json'), payload)
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
        const html = readFileSync(resolve(rootDir, 'dist/index.html'), 'utf8')
        for (const m of html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)) {
          add(m[1])
        }
      } catch (err) {
        console.warn('[emit-asset-manifest] could not read dist/index.html:', err)
      }
      // Firebase chunks are not pre-cached (the SW only reads `assets`), but the
      // student page modulepreloads them after the snapshot renders so the idle
      // import hits a warm HTTP cache.
      const deferred = []
      try {
        for (const file of readdirSync(resolve(rootDir, 'dist/assets'))) {
          if (/^firebase-(config|vendor)-.+\.js$/.test(file)) {
            deferred.push(`/assets/${file}`)
          }
        }
      } catch (err) {
        console.warn('[emit-asset-manifest] could not read dist/assets:', err)
      }
      const payload = JSON.stringify({ assets, deferred })
      writeFileSync(resolve(rootDir, 'dist/asset-manifest.json'), payload)
    },
  }
}

// Dev-only CSP allowance so Impeccable's live design-iteration picker
// (served from http://localhost:8400) can load. Only runs under `vite dev`
// (apply: 'serve'); never touches the static HTML source or the prod build.
function injectImpeccableLiveDevCsp() {
  return {
    name: 'inject-impeccable-live-dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace(/(script-src [^;"]*)(;|")/, '$1 http://localhost:8400$2')
        .replace(/(connect-src [^;"]*)(;|")/, '$1 http://localhost:8400$2')
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
        main: resolve(rootDir, 'index.html'),
        admin: resolve(rootDir, 'admin.html'),
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
  plugins: [emitDeployVersionFile(), emitAssetManifest(), injectImpeccableLiveDevCsp()],
})
