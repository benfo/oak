import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://www.benfourie.com',
  base: '/oak',
  output: 'static',
  trailingSlash: 'always',
  vite: { plugins: [tailwindcss()] },
})
