import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// `base` differs per host:
//   • Netlify → root domain → '/'
//   • GitHub Pages → https://<user>.github.io/congtran/ → '/congtran/'
// Netlify sets NETLIFY=true automatically during its build.
const base = process.env.NETLIFY ? '/' : '/congtran/'

export default defineConfig({
  plugins: [react()],
  base,
})
