import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // mirrors the vercel.json /backend rewrite so dev and prod use the same URL
  server: {
    proxy: {
      '/backend': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/backend/, ''),
      },
      // prod serves the index from the CDN edge fn (api/index.ts); in dev go
      // straight at the source it reads from
      '/jobs.json': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: () => '/recent',
      },
    },
  },
})
