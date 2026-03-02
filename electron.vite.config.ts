import path, { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        'react':     path.resolve('./node_modules/react'),
        'react-dom': path.resolve('./node_modules/react-dom'),
      }
    },
    plugins: [react()]
  }
})
