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
    },
  },
  plugins: [emitDeployVersionFile()],
})
