import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),
  VitePWA({
    registerType: 'autoUpdate',          // SW updates auto
    injectRegister: 'auto',              // injects the register script
    devOptions: { enabled: true },       // enables PWA in dev (optional)
    includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
    manifest: {
      name: 'DevNexus',
      short_name: 'DevNexus',
      description: 'The developer community platform for sharing code, ideas, and opportunities.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#3C81D2',            // match your brand / meta theme-color
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallback: '/index.html',   // SPA fallback for react-router
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      runtimeCaching: [
        // API cache (tune URL pattern to your backend)
        {
          urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            networkTimeoutSeconds: 4,
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        // images
        {
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'img-cache', cacheableResponse: { statuses: [0, 200] } }
        },
        // fonts
        {
          urlPattern: ({ request }) => request.destination === 'font',
          handler: 'CacheFirst',
          options: {
            cacheName: 'font-cache',
            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] }
          }
        }
      ]
    }
  })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // server: {
  //   proxy: {
  //     // dev proxy: http://localhost:5173/api -> http://localhost:5000/api
  //     '/api': { target: 'http://localhost:5000', changeOrigin: true }
  //   }
  // }
})