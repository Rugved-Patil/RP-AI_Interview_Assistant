import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all local and tunnel interfaces
    port: 5173,
    allowedHosts: true, // Allow tunnel domains (localtunnel, cloudflare, ngrok)
    proxy: {
      '/sessions': 'http://localhost:8000',
      '/interviews': 'http://localhost:8000',
      '/reports': 'http://localhost:8000',
      '/analytics': 'http://localhost:8000',
      '/presets': 'http://localhost:8000',
      '/questions': 'http://localhost:8000',
      '/sandbox': 'http://localhost:8000',
      '/settings': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/data': 'http://localhost:8000',
    },
  },
})

