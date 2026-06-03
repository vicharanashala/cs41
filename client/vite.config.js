import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'http'
import https from 'https'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Reuse a persistent HTTP Agent so the backend connection stays open.
        // This prevents Node/Vite from adding 'connection: close', which avoids
        // the 'Unable to determine content-length' proxy buffering warning.
        agent: new http.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
      },
    },
  },
})
