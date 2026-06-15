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

  if (id.includes('/node_modules/@phosphor-icons/react/')) {
    return 'icon-vendor'
  }

  if (id.includes('/node_modules/recharts/')) return 'charts-vendor'
  if (id.includes('/node_modules/@radix-ui/')) return 'radix-vendor'
  if (
    id.includes('/node_modules/@mui/') ||
    id.includes('/node_modules/@emotion/')
  ) {
    return 'mui-vendor'
  }

  return 'vendor'
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
          theme_color: '#007FFF',
          background_color: '#F8F7FF',
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
          globPatterns: [
            '**/*.{js,css,html,ico,png,svg,woff,woff2,PNG,SVG,WEBP,webp}',
            'illustrations/*.{webp,WEBP,svg,SVG}'
          ],
          // ── Caching strategy ──────────────────────────────────────────────
          // StaleWhileRevalidate: serve cached response INSTANTLY, then update
          // cache in the background. This is what makes return visits feel
          // native — the user never waits for the network on content they've
          // seen before.
          //
          // NetworkFirst is only used for auth — sessions must always be
          // validated against the server to prevent stale credential issues.
          //
          // CROSS-USER SAFETY: Workbox keys cache entries by URL only, ignoring
          // the Authorization header. For queries that include `user_id` in the
          // URL (transactions, liabilities, loans, etc.), user A and user B
          // produce different URLs and there is no leak. For Splitwise queries
          // that rely on RLS without an explicit `user_id` filter, the URL is
          // identical across users — so we MUST purge the `supabase-data`
          // cache on every auth boundary. That purge lives in
          // `src/hooks/useAuth.js#purgeAllUserScopedState()` and runs on:
          //   • imperative signOut()
          //   • passive SIGNED_OUT auth event
          //   • first SIGNED_IN of any session (catches "previous user closed
          //     the tab without signing out, new user opened a fresh browser")
          // If those purges ever stop firing, this rule will leak again.
          runtimeCaching: [
            {
              // Supabase auth endpoints — NetworkFirst (always validate session)
              urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Supabase data endpoints — StaleWhileRevalidate (instant + fresh)
              //
              // Cache key includes the URL fragment that `customFetch` in
              // `src/lib/supabase.js` adds (e.g. `…#kosha-uid=<id>`). This
              // makes the cache mechanically per-user: user A and user B
              // produce different cache keys even for identical Supabase
              // URLs (e.g. the RLS-only `GET /rest/v1/split_groups`). The
              // fragment is stripped by the browser before the network
              // request, so the server sees the same URL it always has.
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'supabase-data',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 12 * 60 * 60, // 12 hours — robust offline support
                },
                cacheableResponse: { statuses: [200] },
                plugins: [
                  {
                    // Be explicit: include the URL fragment in the cache key.
                    // Workbox's default behaviour already uses `request.url`
                    // which preserves the fragment, but spelling it out here
                    // documents intent and protects against future internal
                    // normalisation changes in Workbox.
                    cacheKeyWillBeUsed: async ({ request }) => request.url,
                  },
                ],
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
