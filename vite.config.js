import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Project page on GitHub Pages: https://1zyaam.github.io/zyam-web/
  base: '/zyam-web/',
  plugins: [react()]
})
