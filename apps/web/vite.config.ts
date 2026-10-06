import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    // Same origin for web and API in development, so the sameSite=lax auth cookie is sent (architecture §8)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
