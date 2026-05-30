import { defineConfig } from 'vite'
import { resolve } from 'path'
import { writeFileSync, readFileSync, readdirSync } from 'fs'

function emitDeployVersionFile() {
  return {
    name: 'emit-deploy-version-file',
    closeBundle() {
      const payload = JSON.stringify({ v: new Date().toISOString() })
      writeFileSync(resolve(__dirname, 'dist/version.json'), payload)
    },
  }
}

// Emit asset-manifest.json so the service worker can pre-cache the student
// entry's hashed JS/CSS chunks on install. We only list assets referenced by
// /index.html (the student PWA shell) — admin-only chunks like pdf-flyer
// (410KB) and pdf.worker (1.2MB) are deliberately excluded so a brand-new
// install doesn't burn 2MB of mobile data pre-caching admin code students
// never run.
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
      // 1. Anything the student index.html references directly.
      try {
        const html = readFileSync(resolve(__dirname, 'dist/index.html'), 'utf8')
        for (const m of html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)) {
          add(m[1])
        }
      } catch (err) {
        console.warn('[emit-asset-manifest] could not read dist/index.html:', err)
      }
      // 2. Student-side dynamic-import chunks (firebase-config + firebase
      //    vendor + shared helpers used by the student feed). Explicitly
      //    exclude admin/advisor/pdf chunks so a student install doesn't burn
      //    ~2MB on admin-only code.
      try {
        const assetsDir = resolve(__dirname, 'dist/assets')
        const studentRuntime = readdirSync(assetsDir).filter((name) => {
          if (!/\.(js|mjs|css)$/.test(name)) return false
          if (/^admin/.test(name)) return false
          if (/^advisor-portal/.test(name)) return false
          if (/^pdf/.test(name)) return false
          return /^(firebase-config|firebase-vendor|resource-logo-tile|resource-chip-labels|rich-text)/.test(name)
        })
        for (const name of studentRuntime) {
          add(`/assets/${name}`)
        }
      } catch (err) {
        console.warn('[emit-asset-manifest] could not scan dist/assets:', err)
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
