import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/cards': 'http://localhost:3001',
      '/decks': 'http://localhost:3001',
    },
  },
})
