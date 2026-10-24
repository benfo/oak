import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
    // ES workers can code-split: the highlighting worker loads each language's grammar on demand.
    worker: { format: 'es' }
  }
})
