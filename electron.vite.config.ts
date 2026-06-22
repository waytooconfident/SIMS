/// <reference types="node" />
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// resolve() without a base resolves from process.cwd() = project root
// which is always where electron-vite is invoked from.
const r = (...paths: string[]) => resolve(process.cwd(), ...paths)

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': r('src/shared') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': r('src/shared') }
    }
  },
  renderer: {
    root: r('src/renderer'),
    build: {
      rollupOptions: {
        input: r('src/renderer/index.html')
      }
    },
    resolve: {
      alias: {
        '@renderer': r('src/renderer/src'),
        '@shared': r('src/shared')
      }
    },
    plugins: [react()]
  }
})
