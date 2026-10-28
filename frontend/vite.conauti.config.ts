import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(
    new URL('./conauti-ui/', import.meta.url)
  ),
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api/conauti': {
        target: 'http://127.0.0.1:8140',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: fileURLToPath(
      new URL('./dist-conauti/', import.meta.url)
    ),
    emptyOutDir: true,
  },
})
