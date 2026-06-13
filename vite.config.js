import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Electron loads the renderer from this dev server (or the built files).
// base: './' makes asset paths relative so file:// loading works in production.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
})
