import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built app works when opened from any path / static host.
export default defineConfig({
  base: './',
  plugins: [react()],
})
