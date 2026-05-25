import { defineConfig } from 'vite'
import { resolve } from 'path'
import { writeFileSync } from 'fs'

function emitDeployVersionFile() {
  return {
    name: 'emit-deploy-version-file',
    closeBundle() {
      const payload = JSON.stringify({ v: new Date().toISOString() })
      writeFileSync(resolve(__dirname, 'dist/version.json'), payload)
    },
  }
}

export default defineConfig({
  build: {
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
          if (id.includes('node_modules/firebase')) {
            return 'firebase-vendor'
          }
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'pdfjs-vendor'
          }
        },
      },
    },
  },
  plugins: [emitDeployVersionFile()],
})
