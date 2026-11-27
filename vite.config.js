import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages project page: https://1zyaam.github.io/zyam-web/
  // Netlify (and local) builds keep base '/'.
  base: process.env.GITHUB_PAGES === 'true' ? '/zyam-web/' : '/',
  plugins: [react()]
})
