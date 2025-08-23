import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health':  'http://localhost:3001',
      '/events':  'http://localhost:3001',
      '/stats':   'http://localhost:3001',
      '/status':  'http://localhost:3001',  // /status/nudges
      '/notify':  'http://localhost:3001',  // /notify/test
      '/export':  'http://localhost:3001'
    }
  }
})
