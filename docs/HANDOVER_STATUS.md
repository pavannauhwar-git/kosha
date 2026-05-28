# Kosha — Performance & Polish Handover Status

Maintained per Section A.8 of `docs/UI_PERF_HANDOVER.md`.
One entry per commit. Reviewer scans for `✗` and `PENDING-*` entries.

---

## FIX-001 — Remove double-wrapped `startTransition` in BottomNav

- **Commit:** 405b97e
- **PR:** pending
- **Files modified:** `src/App.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built in 19.22s)
- **Automated verify steps:** ✓ ESLint passes (0 errors)
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Tap each nav tab on a real phone; should switch on first tap every time
- **Discovered out of scope:** Nothing
- **Notes:** `startTransition` removed from React imports (no longer used anywhere in the file). Static `hapticTap` import added from `./lib/haptics`. Batched with FIX-002 per section 3 row 1.

---

## FIX-002 — Collapse three event handlers into `onPointerEnter` + `onFocus`

- **Commit:** 405b97e
- **PR:** pending
- **Files modified:** `src/App.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built in 19.22s)
- **Automated verify steps:** N/A (Chrome DevTools trace verify requires a browser)
- **Manual verify steps:** PENDING-DESKTOP-VERIFICATION — Chrome DevTools Performance recording → tap a tab → no `prefetchRoute` call in the trace during the tap gesture; only after it completes
- **Discovered out of scope:** Nothing
- **Notes:** `onMouseEnter` and `onTouchStart` replaced by single `onPointerEnter` guarded with `e.pointerType !== 'touch'`. Batched with FIX-001 per section 3 row 1.

---
## FIX-004 — Static-import `hapticTap` everywhere (kill dynamic haptic imports)

- **Commit:** 04c3dca
- **PR:** pending
- **Files modified:** `src/pages/Obligations.jsx`, `src/components/ui/Button.jsx`, `src/components/ui/BottomSheet.jsx`, `src/components/transactions/TransactionItem.jsx` (App.jsx done in FIX-001)
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built in 20.05s)
- **Automated verify steps:** ✓ `git grep "import\(.*haptics" src/` returns zero matches
- **Manual verify steps:** N/A — verify step is lint/grep only
- **Discovered out of scope:** Nothing
- **Notes:** All 5 remaining dynamic haptic import sites replaced. `hapticHeavy`, `hapticTap`, and `hapticSuccess` statically imported where needed.

---
## FIX-003 — Defer route-data prefetch off the main thread

- **Commit:** 62c3d9e
- **PR:** pending
- **Files modified:** `src/App.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built in 19.39s)
- **Automated verify steps:** N/A (Chrome DevTools Performance verify requires a browser)
- **Manual verify steps:** PENDING-DESKTOP-VERIFICATION — Chrome DevTools → hover any tab on desktop → no long task > 50 ms
- **Discovered out of scope:** Nothing
- **Notes:** Data-prefetch body extracted into module-level `runDataPrefetch(path, activeUserId)` function. `useCallback` now wraps the call in `requestIdleCallback` (with `setTimeout(cb, 0)` fallback). Chunk preload still fires immediately. Per-path query logic unchanged.

---
## FIX-005 — Parallel-preload nav-bar chunks after auth resolves

- **Commit:** 1455e45
- **PR:** pending
- **Files modified:** `src/App.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓
- **Automated verify steps:** N/A (Network waterfall verify requires a browser)
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — DevTools Network tab on login → after auth completes, 6 nav-chunk JS imports fire in parallel, not sequentially
- **Discovered out of scope:** Nothing
- **Notes:** `EagerChunkPreloader` now consumes `useAuth().loading`. Nav-bar chunks (6) fire in parallel via `Promise.allSettled` immediately after auth resolves. Secondary chunks (6) deferred to `requestIdleCallback` (timeout 6 s, fallback `setTimeout(2000)`).

---
## FIX-006 — Inject `<link rel="modulepreload">` for nav chunks in build

- **Commit:** 8ff24da
- **PR:** pending
- **Files modified:** `vite.config.js`
- **Lint pass:** N/A (config file, not linted by eslint)
- **Build pass:** ✓ (built in 22.87s)
- **Automated verify steps:** ✓ `grep modulepreload dist/index.html` — 6 nav-page hints found (Dashboard, Transactions, Monthly, Analytics, Obligations, Splitwise)
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Chrome DevTools Network → cold reload → 6 nav chunks start loading during HTML parse (priority: High)
- **Discovered out of scope:** Nothing
- **Notes:** Vite plugin `kosha-modulepreload-nav-chunks` added after `react()` in plugins array. `enforce: 'post', apply: 'build'` so it only runs during builds. `transformIndexHtml.order: 'post'` ensures chunk filenames are known before injection.

---
## FIX-007 — Set `refetchOnMount: false` in queryClient

- **Commit:** 9ec208c
- **PR:** pending
- **Files modified:** `src/lib/queryClient.js`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓
- **Automated verify steps:** N/A (network-level verify requires a browser)
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Dashboard → Transactions → Dashboard within 5 min → zero network requests on second Dashboard mount. Also: background app 2 min → return → queries refetch (window focus)
- **Discovered out of scope:** Nothing
- **Notes:** `refetchOnMount: true → false`. `refetchOnWindowFocus: false → true` (safety belt). `refetchOnReconnect: 'always'` already present. Mutations still explicitly invalidate via `invalidateQueryFamilies`, so stale marking still triggers refetch on next mount.

---
## FIX-008 — Replace `MutationObserver` with `matchMedia` for theme-color

- **Commit:** 3612652
- **PR:** pending
- **Files modified:** `src/main.jsx`, `src/pages/Settings.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓
- **Automated verify steps:** N/A (DevTools verify requires a browser)
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Toggle dark mode in Settings → meta `theme-color` updates. DevTools → Elements → `<html>` shows no `MutationObserver` attached
- **Discovered out of scope:** Nothing
- **Notes:** IIFE in `main.jsx` now uses `mql.addEventListener('change')` instead of `MutationObserver`. Exposed `window.__koshaApplyThemeColor` for `Settings.jsx#toggleDarkMode`. OS-level dark mode change auto-applies when no explicit preference set.

---

## FIX-009 — Wrap routes in `useDeferredValue` to remove skeleton flash

- **Commit:** 5a917c061ecb46e4d521ed7898c378edc05bac86
- **PR:** pending
- **Files modified:** `src/App.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A (requires visual browser check)
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — On a throttled network ("Slow 3G"), tap any tab — the previous page should dim very slightly (~8%), then crossfade to the new page. No skeleton flash. The dim is intentionally subtle.
- **Discovered out of scope:** Nothing
- **Notes:** Wrapped `<Routes>` in `<AppRoutes>` which tracks `isStale` using `useDeferredValue(location)` and controls the opacity/pointerEvents of the container `div`. Removed `AnimatedRoutes` and imported `useDeferredValue`.

---

## FIX-050 — Profile avatar shows `?` while loading

- **Commit:** 391cc5dde502cb9d5117cd3e04ae4b704163df07
- **PR:** pending
- **Files modified:** `src/components/ui/SecureAvatar.jsx`, `src/lib/safeStorage.js`, `src/components/navigation/ProfileMenu.jsx`, `src/pages/Settings.jsx`, `src/pages/Splitwise.jsx`, `src/components/dialogs/ViewProfilePhotoDialog.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A (requires a browser and network)
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Hard-reload the app on a slow network. The profile menu trigger shows the user's first initial, never `?`. Reload again — avatar appears instantly from cache.
- **Discovered out of scope:** Nothing
- **Notes:** Swapped volatile in-memory Map for localStorage cache with 6-day TTL. Derives uppercase first letter of `alt` as the placeholder initial so it never displays `?` when loading or empty. Added explicit cache purges in safeStorage.js and wired up `fallbackInitial` from all call sites.

---

## FIX-010, FIX-011, FIX-012 — drop backdrop blur on touch; tune M3 Expressive springs

- **Commit:** cfb59247005c7d99d1d7d4e9cb4e8ae69ccba672
- **PR:** pending
- **Files modified:** `src/App.jsx`, `src/index.css`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Tap between tabs on a real phone — the pill should have a barely-perceptible bounce at the end of its travel. Scroll Dashboard on a phone — frame rate should be a stable 60fps (no drop due to backdrop-filter). Press nav items — the press should feel slightly softer (100ms scale(0.9) with M3 emphasized decel).
- **Discovered out of scope:** Nothing
- **Notes:** Batched FIX-010, FIX-011, and FIX-012 under Row 9. Removed backdrop-filter from `.nav-float-wrap` on touch devices while keeping it on desktops. Tuned springs of `layoutId="nav-pill"` and `motion.span` (active icon) in `App.jsx` to M3 Expressive specs.

---

## FIX-013, FIX-014, FIX-015 — M3 Expressive open spring; drop touch-device backdrop blur; always disable swipe-to-open

- **Commit:** 015fdeab326eebafd9e61d5838ffcd36c6a02b2d
- **PR:** pending
- **Files modified:** `src/components/ui/BottomSheet.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Open any bottom sheet on a phone — it should feel decisive and fast, with no visible bounce/overshoot. Phone backdrop should not blur, while desktop background continues to show a frosted blur. Slide up from the bottom edge of an Android phone — no drawer should open via discovery.
- **Discovered out of scope:** Nothing
- **Notes:** Batched FIX-013, FIX-014, and FIX-015 under Row 10. Swipeable drawer discovery is always disabled (`disableDiscovery={true}`). Backdrops do not blur on touch devices. Open animations use Material 3 Expressive Emphasized.

---

## FIX-017, FIX-020, FIX-021, FIX-022 — race conditions and main-thread blockers

- **Commit:** 435d0887fd56892eaea5b5b57acbc28102e420f5
- **PR:** pending
- **Files modified:** `src/App.jsx`, `src/pages/Dashboard.jsx`, `src/lib/runtimeMonitor.js`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Switch wallets rapidly via the ProfileMenu — no cross-wallet data leakage. Mount/unmount Dashboard repeatedly — no React state update warnings in console. Hover/transition between pages — no long tasks from runtime monitor sessionStorage writes. Focus/defocus PWA — reduced layout recalculation from reminder prefs read.
- **Discovered out of scope:** Nothing
- **Notes:** Batched FIX-017, FIX-020, FIX-021, and FIX-022 under Row 11. Cancelled in-flight prefetches on activeUserId change. Guarded time ticker interval against unmount states. Deferred recordRuntimeRoute writes with setTimeout(cb, 0). Throttled reminder prefs storage reads using requestAnimationFrame.

---

## FIX-018 — Capture query/mutation errors in Sentry

- **Commit:** 3f2e40f628c30f092297ca07298053404f77efbd
- **PR:** pending
- **Files modified:** `src/lib/errorReporting.js`, `src/lib/queryClient.js`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A (requires Sentry connection)
- **Manual verify steps:** PENDING-PROD-OBSERVATION — Simulate offline, navigate Dashboard. Sentry should receive an event with `tags.source=react-query`.
- **Discovered out of scope:** Nothing
- **Notes:** Extended captureError in errorReporting.js to accept `tags`. QueryClient is now configured with a global QueryCache and MutationCache that intercepts errors, ignores 401/403/auth related failures, and sends query/mutation keys to Sentry with context.

---

## FIX-019 — Disable submit during in-flight mutation (kill double-submit)

- **Commit:** 3e6d5e9dabc1df2aeeaf073911f3829e54ed52b4
- **PR:** pending
- **Files modified:** `src/components/obligations/Bills.jsx`, `src/components/obligations/Loans.jsx`, `src/pages/Splitwise.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Rapid-tap Save 5 times in 100 ms on bills, loans, and Splitwise forms → only one record created, and the button visually locks after the first tap.
- **Discovered out of scope:** Nothing
- **Notes:** Added `isSubmitting`/`actionGuard` checks and ref locks to prevent rapid duplicate mutation calls before state updates re-render the disabled button states.

---

## FIX-023 — Memoize list rows

- **Commit:** d95e448f4de2952c527664c56ec8a12a459014b2
- **PR:** pending
- **Files modified:** `src/components/transactions/TransactionItem.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — React DevTools → "Highlight updates when components render" → filter Transactions list → only affected/changed rows highlight, unchanged rows do not re-render.
- **Discovered out of scope:** `src/components/bills/BillRow.jsx` and `src/components/loans/LoanRow.jsx` do not exist (bills and loans rows are rendered inline inside parent components).
- **Notes:** (Option A chosen by user) Replaced default `memo(TransactionItem)` with a custom prop comparator mapping correct active props (`txn`, `isHighlighted`, `isLast`, `compact`, `showDate`, `autoNudge`, `searchQuery`) to prevent unnecessary list row re-renders. Skipped `BillRow` and `LoanRow` as they are inline elements.

---

## FIX-025 — Remove `fade-up-N` stagger below the Dashboard fold

- **Commit:** fd9807a66e019256e09a9cc57e2982aa95e9ec34
- **PR:** pending
- **Files modified:** `src/pages/Dashboard.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Visual: Hard refresh Dashboard. Hero card/above fold fades in; everything below appears together. Profiler: scroll on Dashboard shows fewer composite layers.
- **Discovered out of scope:** Nothing
- **Notes:** Changed below-the-fold entrance animations from staggered translating springs (`card-spring-in fade-up-N`) to smooth, layout-safe, GPU-accelerated standard `fade-in` (opacity-only) transitions.

---

## FIX-026 — Wire `document.startViewTransition` for tab switches (where supported)

- **Commit:** f09d3bd0c51e26e9a6f47539a9352fa28275f6a4
- **PR:** pending
- **Files modified:** `src/App.jsx`, `src/index.css`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Visual: Switch tabs in Chromium → smooth crossfade. Switch tabs in Safari (unsupported) → falls back to instant swap.
- **Discovered out of scope:** Nothing
- **Notes:** Added `navigateWithViewTransition` helper inside `App.jsx` and wrapped `BottomNav` `onClick` navigations with it. Added native CSS crossfade keyframes and `@view-transition` config in `src/index.css`.

---

## FIX-027 — Hero amount typography: small paise on Dashboard + Monthly

- **Commit:** 80074436dbd6c721ea25f264edbcd3ef5b7d7660
- **PR:** pending
- **Files modified:** `src/lib/utils.js`, `src/components/cards/dashboard/DashboardHeroCard.jsx`, `src/components/cards/monthly/MonthHeroCard.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Visual: Check the rupee amounts on the Dashboard and Monthly hero cards. Paise should render in a subordinate span scaled to exactly 60% of the parent font size at `opacity-75`.
- **Discovered out of scope:** Nothing
- **Notes:** Added locale-aware `splitFmtAmount(n)` helper in `src/lib/utils.js` that uses `Intl.NumberFormat.formatToParts` to safely extract major and minor sections. Applied the helper to render sub-scaled paise on `DashboardHeroCard` and `MonthHeroCard`.

---

## FIX-028, FIX-029 — Tap targets (48x48 dp minimum) and focus-visible rings

- **Commit:** 3e27f2f3f9bb6c6feea0d6eac14938a7799c49c8
- **PR:** pending
- **Files modified:** `src/index.css`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Visual/Tab: Tab through dashboard/nav with keyboard → focus rings appear on active element. Tap with finger → no rings. Swipe and tap tiny elements (dismiss card button, profile elements) → verify expanded hit target makes tapping 100% reliable.
- **Discovered out of scope:** Nothing
- **Notes:** (Option 1 chosen by user) Replaced box-shadow based focus rings with a premium solid outline indicator with offset for `:focus-visible` elements. Added centered invisible `::after` pseudo-element overlays on all `button` and `[role="button"]` elements to ensure their touch target meets WCAG 2.2 / Material 48px standard without changing visual sizes or layout positions.

---

## FIX-039 — Splitwise settlement creates only the payer's transaction (data bug)

- **Commit:** 10699e3e16faf7989e1ec997f9b0a76a8fc352a5
- **PR:** pending
- **Files modified:** `supabase/schema.sql`, `supabase/migrations/backfill_split_settlement_payee_txns.sql`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** PENDING-DBA-APPROVAL — Verification of schema function & execution of the backfill script
- **Manual verify steps:** PENDING-DBA-APPROVAL — Database schema deployment and subsequent database manual checks
- **Discovered out of scope:** Nothing
- **Notes:** Changed `split_record_settlement` SQL function in `supabase/schema.sql` to bypass RLS (`security definer`), enforce payer/payee check on the calling user to prevent forgery, and unconditionally sync transactions for both linked users. Wrote corresponding idempotent backfill migration in `supabase/migrations/backfill_split_settlement_payee_txns.sql`.

---

## FIX-041 — "Whole page reloaded" feel on tab switches

- **Commit:** e8175cf40f74394d79ff2029928aa80bb592ea28
- **PR:** pending
- **Files modified:** `src/hooks/useFirstRouteVisit.js`, `src/pages/Dashboard.jsx`, `src/pages/Monthly.jsx`, `src/pages/Analytics.jsx`, `src/pages/Obligations.jsx`, `src/lib/safeStorage.js`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — First time you open Dashboard/Monthly/Analytics/Obligations → greeting and hero/cards fade-up. Navigate to other tabs, come back → no fade-up, content is immediately in place. Sign out and back in → fade-ups re-fire (session was reset).
- **Discovered out of scope:** `Splitwise.jsx` and `Transactions.jsx` have no `.fade-up` or other entrance animation classes, so they do not suffer from the revisit animation issue and did not require the hook.
- **Notes:** Created `useFirstRouteVisit` hook to track whether a route has been visited in the current session via sessionStorage. Applied to conditionalize the `fade-up` class on the above-the-fold elements of Dashboard, Monthly, Analytics, and Obligations pages. Configured `purgeUserScopedKeys` in `safeStorage.js` to purge these visited session markers on user sign-out.


---

## FIX-040 — ProfileMenu open/close animation feels wrong

- **Commit:** db6e4ec43417af77870f266501162ac5402a4e03
- **PR:** pending
- **Files modified:** `src/components/navigation/ProfileMenu.jsx`, `src/index.css`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Tap the avatar → menu fades in with a subtle scale-from-top-right (anchored at the avatar). Tap outside → menu fades out in ~200 ms cleanly.
- **Discovered out of scope:** Nothing
- **Notes:** Switched the popover transition primitive in `ProfileMenu.jsx` from `Grow` to `Fade`. Layered a CSS scale-up animation (`.profile-menu-paper` using `profile-menu-pop`) with a custom cubic-bezier timing of 220ms, styled to visual transform-origin based on whether it is a normal popover or a drop-up popover, producing a quick Pixel-correct menu pop.

---

## FIX-042, FIX-043, FIX-044 — BottomSheet dvh, image decoding, GPU layer leaks

- **Commit:** 259dd274310a0199348a9e445433bbbeb76961bf
- **PR:** pending
- **Files modified:** `src/components/ui/BottomSheet.jsx`, `src/components/ui/SecureAvatar.jsx`, `src/components/navigation/ProfileMenu.jsx`, `src/components/errors/KoshaErrorPage.jsx`, `src/index.css`, `src/pages/About.jsx`, `src/pages/Guide.jsx`, `src/pages/InviteLanding.jsx`, `src/pages/Login.jsx`, `src/pages/Obligations.jsx`, `src/pages/Onboarding.jsx`, `src/pages/Reconciliation.jsx`, `src/pages/ReportBug.jsx`, `src/pages/Splitwise.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** ✓ ESLint and build pass
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Open a long bottom sheet on a phone to verify viewport height is correct. Verify image decodes off main thread. Verify count of compositor layers drop on Transactions / Dashboard page.
- **Discovered out of scope:** `src/components/brand/KoshaLogo.jsx` and `src/components/common/EmptyState.jsx` already had `decoding="async"` applied.
- **Notes:** Batched FIX-042, FIX-043, and FIX-044 under Row 22. Swapped `100vh` for `100dvh` in `BottomSheet.jsx`, added `decoding="async"` to image tags across pages, and removed `will-change` from `.fade-up`, `.card-spring-in`, `.fade-in`, and `.hero-card-enter` classes in `index.css`.

---

## FIX-052 — Mark touchstart listeners as passive

- **Commit:** f90ec404950463001a0fd026195535b711cb03b2
- **PR:** pending
- **Files modified:** `src/components/obligations/Bills.jsx`, `src/components/obligations/Loans.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A (Chrome DevTools console verify requires a browser)
- **Manual verify steps:** PENDING-DESKTOP-VERIFICATION — Open Bills or Loans page in Chrome DevTools → confirm the "Added non-passive event listener to a scroll-blocking 'touchstart' event" warning is gone
- **Discovered out of scope:** Nothing
- **Notes:** Added `{ passive: true }` option to both `addEventListener` and `removeEventListener` calls for `touchstart` in `Bills.jsx` and `Loans.jsx`. The `mousedown` listeners were left unchanged (not scroll-blocking).

---

## FIX-053 — Replace `type="number"` with `type="text" inputMode="decimal"` for money inputs

- **Commit:** 4d4e3ca244c0b5c13df1814a2433c37e8abf2a44
- **PR:** pending
- **Files modified:** `src/components/obligations/Bills.jsx`, `src/components/obligations/Loans.jsx`, `src/components/analytics/AnalyticsCharts.jsx`, `src/pages/Splitwise.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built successfully)
- **Automated verify steps:** N/A (requires browser interaction)
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — On any modified page, focus an amount input and scroll the page — value should not change. Confirm no spinner arrows visible on desktop. On mobile, numeric-with-decimal keypad still appears.
- **Discovered out of scope:** `src/components/categories/BudgetSheet.jsx` has no `type="number"` inputs (grep confirmed). `AnalyticsCharts` axis-bound inputs (`whatif-reduction`, `runway-corpus`) use `inputMode="numeric" pattern="[0-9]*"` (integer-only) per doc spec.
- **Notes:** Applied `type="text" inputMode="decimal" pattern="[0-9.]*"` to all decimal money inputs across Bills (1 site), Loans (3 sites), and Splitwise (5 sites). AnalyticsCharts integer inputs use `inputMode="numeric" pattern="[0-9]*"` instead per doc note at line 3338.

---

## FIX-051 — Standalone `console.error` calls don't reach Sentry

- **Commit:** 38f5ff875169250bf663c869fdf0418e4f3f9636
- **PR:** pending
- **Files modified:** `src/pages/Onboarding.jsx`, `src/pages/InviteLanding.jsx`, `src/pages/Splitwise.jsx`, `src/pages/Settings.jsx`, `src/components/ui/SecureAvatar.jsx`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built in 34.16s)
- **Automated verify steps:** N/A (Sentry verify requires production deployment)
- **Manual verify steps:** PENDING-PROD-OBSERVATION — After deploy, trigger each modified error path and confirm a Sentry event arrives with the correct `context` tag (e.g. `onboarding.finish`, `inviteLanding.preview`, `splitwise.changeBanner`, `settings.shareApp`, `secureAvatar.fetchSignedUrl`).
- **Discovered out of scope:** `src/lib/invites.js:93` and `:114` console.errors were left as-is — both are inside library functions that re-throw (callers will capture). `src/lib/reconciliation.js` and `src/lib/supabase.js` only have `console.warn` calls (informational, not error paths) — left as-is per doc rules.
- **Notes:** Added `captureError` import and call alongside each standalone `console.error` catch block in the 5 listed files (6 total call sites). `invites.js` re-throwing catches were deliberately skipped (they bubble to callers handled by React Query / FIX-018).

---

## FIX-054 — Sentry React Router v6 browser tracing integration

- **Commit:** b41e06642d675c1e2ddad7de4b20aece9b47d410
- **PR:** pending
- **Files modified:** `src/lib/errorReporting.js`
- **Lint pass:** ✓ (0 errors, 604 pre-existing warnings)
- **Build pass:** ✓ (built in 44.56s)
- **Automated verify steps:** N/A (Sentry performance data populates in production over 24 h)
- **Manual verify steps:** PENDING-PROD-OBSERVATION — After deploy, open Sentry Performance tab, filter by `transaction:Dashboard` (or any route name) — per-route p50/p75/p95 should populate over the next 24 h.
- **Discovered out of scope:** Nothing
- **Notes:** Replaced `Sentry.browserTracingIntegration()` with `Sentry.reactRouterV6BrowserTracingIntegration({ useEffect, useLocation, useNavigationType, createRoutesFromChildren, matchRoutes })`. The five React Router hooks are imported from `react` and `react-router-dom` at the top of the file. `BrowserRouter` (Kosha's router) is compatible with this integration.

---

## FIX-055 — Service Worker cache for Supabase Storage (avatars)

- **Commit:** 1fede2ef342f503efd93d32e3eff35c3354089a2
- **PR:** pending
- **Files modified:** `vite.config.js`
- **Lint pass:** N/A (config file)
- **Build pass:** ✓ (built in 37.84s)
- **Automated verify steps:** N/A
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — Cold-start the PWA → check DevTools → Application → Cache Storage → `supabase-storage` should populate after the first avatar paint. Reload → avatar appears in the *first* paint, no network request.
- **Discovered out of scope:** Nothing
- **Notes:** Added a new cache rule in Workbox configuration specifically for `https://*.supabase.co/storage/*` (CacheFirst strategy). A custom plugin was added to strip query parameters (`?token=...`) from the cache key, so signed URLs resolving to the same underlying avatar image hit the cache. Expiration is set to 1 hour to balance staleness with zero-network paints.









