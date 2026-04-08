# Chapter 1: System Overview & Tech Stack

## 1.1 Product Description and Core Philosophy

Kosha is a mobile-first personal finance Progressive Web App that combines everyday money operations (transactions, bills, loans) with trust-oriented analytics and reconciliation. Architecturally, it is optimized for three outcomes:

1. Fast perceived performance on consumer mobile devices.
2. Strong data integrity with server-truth persistence.
3. Operational resilience during auth refreshes, flaky networks, and runtime faults.

### Core philosophy pillars

1. Server truth, client acceleration
The source of truth is Supabase/Postgres; the UI accelerates perception through cache, prefetch, and staged invalidation rather than replacing canonical state.
Evidence: [src/lib/supabase.js](src/lib/supabase.js#L13), [src/lib/queryClient.js](src/lib/queryClient.js#L3), [src/App.jsx](src/App.jsx#L535)

2. Latency hiding without correctness compromise
Loading skeletons, route-level suspense, and prefetch are used so transitions feel instant, but writes still await backend completion before stabilization.
Evidence: [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L147), [src/App.jsx](src/App.jsx#L94), [src/App.jsx](src/App.jsx#L807)

3. Auth-first stability
Auth bootstrap and token refresh race conditions are explicitly handled with a module-level auth store and guarded initialization paths.
Evidence: [src/hooks/useAuth.js](src/hooks/useAuth.js#L78), [src/hooks/useAuth.js](src/hooks/useAuth.js#L101), [src/lib/authStore.js](src/lib/authStore.js#L1)

4. Fail-soft runtime posture
Global runtime monitoring and error boundaries capture crash context and keep bug-report flow actionable.
Evidence: [src/main.jsx](src/main.jsx#L9), [src/components/errors/GlobalErrorBoundary.jsx](src/components/errors/GlobalErrorBoundary.jsx#L1), [src/lib/runtimeMonitor.js](src/lib/runtimeMonitor.js#L52)

5. Design-system consistency over ad hoc styling
Tailwind tokens, CSS variables, shared animation semantics, and standardized sheet/navigation primitives enforce visual coherence across pages.
Evidence: [tailwind.config.js](tailwind.config.js#L6), [src/index.css](src/index.css#L60), [src/index.css](src/index.css#L486)

---

## 1.2 Complete Tech Stack Breakdown

| Layer | Technology | How Kosha Uses It | Architectural Implication |
|---|---|---|---|
| UI runtime | React 18 | Root rendering under StrictMode with composable providers and lazy route boundaries. | Double-invocation safety and effect discipline are required; startup code is written to be idempotent. |
| Routing | React Router 6 | BrowserRouter + route-level guards + auth callback + fallback routing. | Route security and onboarding gating are centralized and deterministic. |
| Build system | Vite 5 + plugin-react | Fast dev server, ESM build, rollup manual chunking by dependency families. | Smaller initial payload via chunk segmentation; predictable vendor split for cache efficiency. |
| PWA | vite-plugin-pwa (Workbox) | Auto-update service worker, manifest, runtime caching policies, Supabase REST cache bucket. | Offline friendliness and repeat-visit speed; requires careful cache invalidation strategy. |
| Styling | Tailwind CSS 3 + CSS tokens | Semantic palette, radius/typography scales, component classes, safe-area variables. | Design consistency is encoded at config level; new UI should consume tokens, not ad hoc values. |
| Animation | Framer Motion | Page transitions, bottom-nav interaction physics, modal/sheet motion choreography, presence transitions. | Motion is structural (state transition communication), not cosmetic only. |
| Accessible overlays | Radix UI Dialog | Dialog primitives for destructive confirms and sheet-like interactions. | Accessibility semantics (focus trap, portal behavior) are standardized and reusable. |
| Data client | Supabase JS v2 | Auth state machine, PostgREST CRUD, RPC invocations, Realtime channels. | Backend contracts are directly consumed in frontend hooks; schema changes must be coordinated. |
| Query orchestration | TanStack React Query v5 | Global SWR policy, retry heuristics, invalidation families, prefetch pipelines. | Data freshness and performance are controlled centrally, reducing page-level drift. |
| Charting | Recharts | Analytics and dashboard visualization components. | Data shaping at hook/lib layer is essential; chart layer assumes normalized structures. |

Primary evidence anchors:
- [package.json](package.json#L25)
- [package.json](package.json#L38)
- [vite.config.js](vite.config.js#L5)
- [vite.config.js](vite.config.js#L54)
- [vite.config.js](vite.config.js#L81)
- [tailwind.config.js](tailwind.config.js#L5)
- [src/lib/queryClient.js](src/lib/queryClient.js#L3)
- [src/lib/supabase.js](src/lib/supabase.js#L1)
- [src/components/dialogs/DeleteDialog.jsx](src/components/dialogs/DeleteDialog.jsx#L1)
- [src/components/categories/BudgetSheet.jsx](src/components/categories/BudgetSheet.jsx#L2)

---

## 1.3 App Initialization Flow (main.jsx -> App.jsx -> AuthGuard)

This flow is the most important operational path for every developer to understand.

### Phase A: Bootstrap and global safety net

1. Runtime diagnostics listeners are registered before React mount.
Evidence: [src/main.jsx](src/main.jsx#L9), [src/lib/runtimeMonitor.js](src/lib/runtimeMonitor.js#L52)

2. The React root renders inside StrictMode and wraps the full app in a global error boundary.
Evidence: [src/main.jsx](src/main.jsx#L11), [src/main.jsx](src/main.jsx#L13), [src/components/errors/GlobalErrorBoundary.jsx](src/components/errors/GlobalErrorBoundary.jsx#L1)

Practical meaning:
- Unexpected render crashes are intercepted globally.
- Crash context can be forwarded into bug reporting.

### Phase B: Core application composition in App

1. Router is established first with future flags for transition compatibility.
Evidence: [src/App.jsx](src/App.jsx#L914)

2. AuthProvider is mounted outside QueryClientProvider.
Evidence: [src/App.jsx](src/App.jsx#L916), [src/context/AuthContext.jsx](src/context/AuthContext.jsx#L6)

3. QueryClientProvider injects the singleton query client for all route trees.
Evidence: [src/App.jsx](src/App.jsx#L917), [src/lib/queryClient.js](src/lib/queryClient.js#L3)

4. Global background services boot immediately after providers:
- Realtime sync daemon with fallback polling and reconnect backoff.
- Dashboard warm prefetch for first-view responsiveness.
Evidence: [src/App.jsx](src/App.jsx#L535), [src/App.jsx](src/App.jsx#L729), [src/App.jsx](src/App.jsx#L918), [src/App.jsx](src/App.jsx#L919)

5. AppShell mounts structural UI:
- Runtime route tracker
- Custom category loader
- Desktop sidebar / mobile nav
- Animated route outlet
- Query error recovery bar
Evidence: [src/App.jsx](src/App.jsx#L899)

### Phase C: Auth bootstrap state machine

The auth state machine is implemented inside useAuthState and exposed through context.

1. Initial local state starts as loading true and profileLoading true.
Evidence: [src/hooks/useAuth.js](src/hooks/useAuth.js#L12)

2. Supabase onAuthStateChange subscription handles lifecycle events:
- INITIAL_SESSION
- TOKEN_REFRESHED
- SIGNED_IN
- SIGNED_OUT
- USER_UPDATED
Evidence: [src/hooks/useAuth.js](src/hooks/useAuth.js#L78)

3. On INITIAL_SESSION:
- authStore is updated first to eliminate cold-start mutation race.
- user state is set.
- loading is released.
- profile fetch begins if user exists.
Evidence: [src/hooks/useAuth.js](src/hooks/useAuth.js#L82), [src/lib/authStore.js](src/lib/authStore.js#L1)

4. Safety timer releases loading after 3 seconds if INITIAL_SESSION fails to fire.
Evidence: [src/hooks/useAuth.js](src/hooks/useAuth.js#L143)

5. Context value is memoized to prevent broad rerender cascades.
Evidence: [src/context/AuthContext.jsx](src/context/AuthContext.jsx#L18)

### Phase D: Route resolution and guard enforcement

1. Routes are lazy-loaded and wrapped in suspense skeletons per route family.
Evidence: [src/App.jsx](src/App.jsx#L31), [src/App.jsx](src/App.jsx#L807), [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L147)

2. Protected routes are wrapped with AuthGuard.
Evidence: [src/App.jsx](src/App.jsx#L815)

3. AuthGuard logic:
- If auth/profile still loading: show route-matched skeleton.
- If no user: imperative navigate to login.
- If user without onboarded profile: navigate to onboarding.
- Else: render children.
Evidence: [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L157), [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L169), [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L171)

4. Auth callback route resolves post-OAuth/email-link landing and redirects by auth/profile state.
Evidence: [src/App.jsx](src/App.jsx#L519)

---

## 1.4 Initialization Sequence (Operational View)

1. Browser loads bundle built by Vite and chunk-split by dependency families.
Evidence: [vite.config.js](vite.config.js#L5), [vite.config.js](vite.config.js#L48)

2. main.jsx starts runtime monitor and mounts React root under global boundary.
Evidence: [src/main.jsx](src/main.jsx#L9), [src/main.jsx](src/main.jsx#L11)

3. App mounts router and providers, starts realtime and prefetch workers.
Evidence: [src/App.jsx](src/App.jsx#L914), [src/App.jsx](src/App.jsx#L535), [src/App.jsx](src/App.jsx#L729)

4. useAuthState receives INITIAL_SESSION, normalizes user/profile, hydrates context.
Evidence: [src/hooks/useAuth.js](src/hooks/useAuth.js#L82)

5. Route-level suspense displays skeleton while lazy chunks and guard decisions resolve.
Evidence: [src/App.jsx](src/App.jsx#L807), [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L147)

6. AuthGuard either redirects or unlocks protected route subtree.
Evidence: [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L157)

7. User reaches stable interactive state with nav, realtime freshness, and query cache active.

---

## 1.5 Architectural Notes for New Engineers

1. Auth race hardening is intentional and must not be removed casually.
The authStore bridge is a deliberate fix for cold-start token refresh windows.
Evidence: [src/lib/authStore.js](src/lib/authStore.js#L1), [src/hooks/useAuth.js](src/hooks/useAuth.js#L82)

2. Realtime is treated as freshness enhancer, not source of truth.
If websocket fails, the system degrades to periodic invalidation with reconnect backoff.
Evidence: [src/App.jsx](src/App.jsx#L532), [src/App.jsx](src/App.jsx#L535)

3. Suspense + route skeletons are part of perceived-performance architecture.
Do not replace with blank loading states unless UX regression is acceptable.
Evidence: [src/App.jsx](src/App.jsx#L62), [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L147)

4. Styling and motion are token-driven and componentized.
Prefer extending shared tokens/classes over inline one-off values.
Evidence: [tailwind.config.js](tailwind.config.js#L6), [src/index.css](src/index.css#L60)
