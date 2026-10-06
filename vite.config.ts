import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
    }),
    viteReact(),
  ],
  server: { port: 3000 },
})
