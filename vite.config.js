import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined

  if (
    id.includes('/node_modules/react/') ||
    id.includes('/node_modules/react-dom/') ||
    id.includes('/node_modules/scheduler/')
  ) {
    return 'react-vendor'
  }

  if (
    id.includes('/node_modules/react-router/') ||
    id.includes('/node_modules/react-router-dom/') ||
    id.includes('/node_modules/@remix-run/router/')
  ) {
    return 'router-vendor'
  }

  if (id.includes('/node_modules/framer-motion/')) return 'motion-vendor'
  if (id.includes('/node_modules/@tanstack/react-query/')) return 'query-vendor'
  if (id.includes('/node_modules/@supabase/')) return 'supabase-vendor'

  if (id.includes('/node_modules/recharts/')) return 'charts-vendor'
  if (id.includes('/node_modules/@radix-ui/')) return 'radix-vendor'
  if (
    id.includes('/node_modules/@mui/') ||
    id.includes('/node_modules/@emotion/')
  ) {
    return 'mui-vendor'
  }

  // Everything else (icons, chart helpers, Sentry) stays with the chunk that
  // imports it, so the first screen only downloads what it uses.
  return undefined
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProd = mode === 'production'

  return {
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [],
    },
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '0.0.0'),
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './scripts/tests/unit/setup.js',
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'unit-test-anon-key',
      },
      include: ['scripts/tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    },
    build: {
      target: 'esnext',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,
      reportCompressedSize: false,
      sourcemap: isProd && !!env.SENTRY_AUTH_TOKEN,
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'icons/*.png'],
        manifest: {
          name: 'Kosha — Your Financial Sheath',
          short_name: 'Kosha',
          description: 'Personal finance tracker — income, expenses, investments',
          theme_color: '#FFFFFF',
          background_color: '#FFFFFF',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          // Code, fonts and icons are pre-cached on install. Images are cached
          // the first time they're shown, except the two shown when offline or
          // after a crash, which must already be there.
          globPatterns: [
            '**/*.{js,css,html,ico,png,svg,woff,woff2,PNG,SVG}',
            'illustrations/{no_internet,error_hero}.webp',
          ],
          // Supabase data is never cached here: React Query's saved cache
          // (src/lib/queryPersister.js) already gives instant and offline
          // reads, is keyed by user, and is cleared on every sign-in and
          // sign-out.
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'images',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
      }),
      ...(isProd && env.SENTRY_AUTH_TOKEN ? [
        sentryVitePlugin({
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          authToken: env.SENTRY_AUTH_TOKEN,
          sourcemaps: {
            assets: './dist/**',
            ignore: ['node_modules'],
            deleteFilesAfterUpload: './dist/**/*.map',
          },
          telemetry: false,
        }),
      ] : []),
    ],
  }
})
