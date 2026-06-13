import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// MindEase runs fully on-device. The dev server only proxies to a *local* Ollama
// instance; no data ever leaves the machine.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
