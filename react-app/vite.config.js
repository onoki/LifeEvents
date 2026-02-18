import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const stripSetCookieHeader = (proxy) => {
  proxy.on('proxyRes', (proxyRes) => {
    if (proxyRes.headers['set-cookie']) {
      delete proxyRes.headers['set-cookie']
    }
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/LifeEvents/',
  server: {
    proxy: {
      '/proxy-yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy-yahoo/, ''),
      },
      '/proxy-morningstar-indexes': {
        target: 'https://indexes.morningstar.com',
        changeOrigin: true,
        secure: true,
        headers: {
          Origin: 'https://indexes.morningstar.com',
          Referer: 'https://indexes.morningstar.com/',
        },
        configure: stripSetCookieHeader,
        rewrite: (path) => path.replace(/^\/proxy-morningstar-indexes/, ''),
      },
      '/proxy-morningstar-api': {
        target: 'https://www.us-api.morningstar.com',
        changeOrigin: true,
        secure: true,
        headers: {
          Origin: 'https://indexes.morningstar.com',
          Referer: 'https://indexes.morningstar.com/',
        },
        configure: stripSetCookieHeader,
        rewrite: (path) => path.replace(/^\/proxy-morningstar-api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    extensions: [
      '.mjs',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.json'
    ],
  },
})
