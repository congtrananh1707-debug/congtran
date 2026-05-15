import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// `base` is the GitHub Pages subpath: https://<user>.github.io/<repo>/
// For this repo the path is /congtran/.
export default defineConfig({
  plugins: [react()],
  base: '/congtran/',
})
