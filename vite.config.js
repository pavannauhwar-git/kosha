import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined

  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('/scheduler/')
  ) {
    return 'react-vendor'
  }

  if (
    id.includes('/react-router/') ||
    id.includes('/react-router-dom/') ||
    id.includes('/@remix-run/router/')
  ) {
    return 'router-vendor'
  }

  if (id.includes('/framer-motion/')) return 'motion-vendor'
  if (id.includes('/@tanstack/react-query/')) return 'query-vendor'
  if (id.includes('/@supabase/')) return 'supabase-vendor'

  if (
    id.includes('/@phosphor-icons/react/') ||
    id.includes('/lucide-react/')
  ) {
    return 'icon-vendor'
  }

  if (id.includes('/recharts/')) return 'charts-vendor'
  if (id.includes('/@radix-ui/')) return 'radix-vendor'

  return 'vendor'
}

export default defineConfig({
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Kosha — Your Financial Sheath',
        short_name: 'Kosha',
        description: 'Personal finance tracker — income, expenses, investments',
        theme_color: '#3730A3',
        background_color: '#F8F7FF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // ── Caching strategy ──────────────────────────────────────────────
        // StaleWhileRevalidate: serve cached response INSTANTLY, then update
        // cache in the background. This is what makes return visits feel
        // native — the user never waits for the network on content they've
        // seen before.
        //
        // NetworkFirst is only used for auth — sessions must always be
        // validated against the server to prevent stale credential issues.
        runtimeCaching: [
          {
            // Supabase auth endpoints — NetworkFirst (always validate session)
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Supabase data endpoints — StaleWhileRevalidate (instant + fresh)
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-data',
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Google Fonts CSS — CacheFirst (font manifests rarely change)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 5, maxAgeSeconds: 31536000 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts files — CacheFirst (font files never change)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 31536000 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
