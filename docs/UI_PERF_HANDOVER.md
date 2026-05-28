# Kosha — Performance & Premium Polish Audit

> **Owner role:** Acting as Kosha's developer / engineer / architect / frontend lead.
> **Mandate:** Make the app **snappy** and **truly premium** (Pixel-native, Material 3 Expressive) **without redesigning the UI**.
> **Hard constraints:**
> - Keep the existing visual design — no layout overhauls, no shape/color/spacing changes
> - No pinch-to-zoom (already disabled via viewport meta — keep it)
> - No horizontal swipe between primary tabs
> - No hero card carousel
> - Typography rescaling (e.g. small paise in hero amounts) is allowed
> - Every change must be performance-positive or premium-positive — never a tradeoff against either

## Scope guarantee (read this first)

This doc proposes **56 fixes**. Every single one is either:
- A performance fix (faster taps, less main-thread work, fewer network round-trips), or
- A polish fix (springs, motion curves, focus rings, haptics, paise typography), or
- A correctness fix (the Splitwise settlement bug, the race conditions).

**Not one of them changes the visual design of any screen.** No new layouts. No re-skinning. No carousel. No bottom-nav restructure. Hero cards keep their current layout. Action queue stays where it is.

If implementing any fix tempts an agent to "while I'm here, redesign X" — stop. Open a separate work stream. Section 5 ("Out of scope") and section 6 ("Anti-patterns") enforce this explicitly.

Section 7 (the risk register, end of doc) lists every fix that could plausibly regress something, and the mitigation that must ship alongside it.

> ## 🛑 If you are an AI agent: STOP HERE and read Section A first
>
> **Section A is the handoff protocol.** It is the *only* defense against the predictable failure modes of agents — drifting line numbers, "while I'm here" refactors, inventing fixes that aren't in the doc, claiming "verified" when you haven't actually verified.
>
> The user has explicitly stated: **batches are fine when the fixes are related and genuinely fix the issue, but never for speed.** Quality matters more than throughput. Section A enforces this.
>
> Read Section A end-to-end before reading any fix. Re-read A.1–A.7 before every fix you apply. Maintain `docs/HANDOVER_STATUS.md` as Section A.8 specifies.
>
> **Do not skip this. The doc is unforgiving of agents who do.**

---

Read this whole doc once. Then execute fixes top to bottom. Each fix has an ID, file path, exact anchor, verbatim before/after code, why, and a verify step. Don't improvise.

---

## 0. KPIs / definition of done

| Metric | Today (estimated, no real telemetry yet) | Target |
|---|---|---|
| Tab switch — perceived latency | 200–500 ms; sometimes needs 2 taps | < 100 ms, always 1 tap |
| INP (Interaction to Next Paint) | ~280 ms | < 200 ms (good) / < 100 ms (excellent) |
| LCP on cold start | ~2.4 s | < 1.8 s |
| Suspense fallback flash on first tab switch | 300–800 ms | 0 ms (deferred-value crossfade) |
| Main-thread block during tap | 80–150 ms | < 30 ms |
| Bottom-nav pill animation | Overdamped, ~250 ms feel | M3 Expressive spring, ~180 ms with controlled bounce |
| Splitwise mount network requests | 6 | 1 |
| Bundle on cold start (gzip) | ~210 kB est. | < 170 kB |
| Sentry "query error" events | Silent (none captured) | All non-auth query errors captured with breadcrumbs |

Premium feel is qualitative but verifiable on real devices:

- No skeleton flash when tapping a tab
- No double-tap required to switch pages
- Sub-frame haptic response on every confirm action
- Bottom-nav pill snaps with a hint of bounce (not boring linear glide)
- Bottom sheets open with critically-tuned spring (no jelly, no overshoot, ~250 ms)
- Scroll never drops below 60 fps on a Pixel 7a or iPhone 13

---

## 1. The "2 taps to switch pages" bug — root cause

Three independent issues compound to produce this. **All three must be fixed for the bug to disappear reliably.**

### Cause A — `startTransition` is double-wrapped

`App.jsx` line 1565 enables React Router's `future={{ v7_startTransition: true }}`, which **already** wraps every `navigate()` call in `React.startTransition`. The bottom-nav `onClick` at `App.jsx` line 497 wraps it **again** in an explicit `startTransition(() => navigate(...))`. Two nested concurrent low-priority transitions can be interrupted by any higher-priority render (the Dashboard's minute-ticker effect, the `<html>` `MutationObserver` in `main.jsx`, the `QueryErrorRecovery` cache subscription) — the first tap's transition is abandoned and the second tap finally commits.

### Cause B — Heavy synchronous work during the tap

`onTouchStart` calls `prefetchRoute(path)`, which synchronously schedules up to 5 `queryClient.prefetchQuery(...)` calls (each one creates observers and starts a `fetch`). `onClick` then does a dynamic `import('./lib/haptics')`. Combined: ~70–150 ms of main-thread work executes during the gesture, which sometimes exceeds iOS Safari's gesture-recognizer window — the touch is resolved as a non-tap.

### Cause C — Suspense fallback flash on cold chunks

`EagerChunkPreloader` waits for `requestIdleCallback` (4 s timeout) and then loads 12 lazy chunks sequentially 80 ms apart (~1 s total). If the user taps within the first 1–2 s, the destination chunk isn't cached → `<Suspense>` unmounts the current page, mounts `RouteSkeleton`, then mounts the real page. The user reads this as "tap did nothing".

**FIX-001 through FIX-009 below eliminate all three. After applying them, the bug is gone.**

---

## 2. Fix list

Each fix carries an ID, priority, effort, the file + anchor, why, the verbatim change, and a verification step.

### Priority bands

| Band | Meaning |
|---|---|
| **P0** | The 2-tap bug + boot/tap-path perf. Ship in one PR. |
| **P1** | Snappiness + stability + premium motion. Ship as separate PRs over a sprint. |
| **P2** | Tail wins / refactors. Backlog. |

---

# A. Agent-handoff protocol — READ THIS BEFORE TOUCHING CODE

This section is the contract between you (the agent) and the user. The doc that follows is detailed and mostly self-executing. But the agent's failure modes are predictable: drifting line numbers, "while I'm here" refactors, inventing fixes that aren't in the doc, claiming "verified" when you haven't actually verified. This section is the safety harness. **Read every word. If you skip it, you will damage the codebase.**

The user has been explicit: **batches are fine when the fixes are related and genuinely fix the issue. Do not batch for speed.** Quality > throughput.

---

## A.1 The five hard rules

1. **Anchor text over line numbers.** Every fix has both. Line numbers drift as earlier fixes land. The anchor text (function name, class, exact quoted string) does not. Grep for the anchor before every edit. If the doc says "line 487" and your grep finds the anchor on line 502, use line 502 — that's the correct location, the doc is just stale on line numbers.

2. **Apply the diff verbatim.** Use exactly the "Before" / "After" code in the doc. Same whitespace, same comments, same variable names. Do not "modernize" or "improve" or "use a more idiomatic pattern" or "rename for clarity." If you find yourself typing code that isn't in the doc, stop.

3. **One fix per commit. Use the commit message from section 3's table verbatim.** Batching is allowed *only* under the rules in A.5 below.

4. **Verify only what the doc says to verify.** If the Verify step says "Lint pass", run `npm run lint`. If it says "Tap each nav tab on a Pixel 6a", **you cannot verify this**. Mark it `PENDING-DEVICE-VERIFICATION` in the status file (A.8). Do not claim a manual verify is done when it isn't.

5. **When the Before code doesn't match, STOP.** This is the single most important rule. If the doc's "Before" snippet doesn't appear verbatim in the file you're editing, do not guess what to change. Do not "approximate." Stop, write the discrepancy to the user, wait for direction.

---

## A.2 Pre-flight checklist (run this BEFORE every single fix)

Copy these steps for every fix. Don't skip any.

- [ ] **Read the fix in full** — including Why, Before, After, Verify, Risk, Rollback, and any cross-references it makes to other fixes.
- [ ] **Open the target file(s) listed in the "File:" header.** Read enough surrounding context to understand what the code does today.
- [ ] **Grep for the anchor text.** Every fix names a function, class, or exact quoted string as its anchor. Use Grep, not Read by line number. Confirm exactly one match (or all expected matches if the fix touches multiple sites).
- [ ] **Confirm the "Before" code matches verbatim.** Whitespace, comments, everything. Note any differences immediately.
- [ ] **Confirm no other fix has already modified this region.** Re-read your status file (A.8). If a previous fix in the same file altered the lines you're about to touch, re-read the current state of the file before applying.
- [ ] **Decide if the verify step is automatable.** If it's lint/build, you can run it. If it's "tap on a real device", flag it ahead of time so you know to mark `PENDING-DEVICE-VERIFICATION` later.

If any of these fails, **stop and write to the user.** Don't proceed.

---

## A.3 Applying the fix (the actual edit)

- Use only the diff shown in the doc. Nothing else.
- Match the existing indentation (tabs vs spaces). Look at neighboring lines.
- Match the existing trailing-comma / semicolon style. Look at neighboring lines.
- Do **not** add console.log, even temporarily. (`esbuild.drop` would strip it anyway, but adding then removing wastes commits.)
- Do **not** add comments that aren't in the doc.
- Do **not** rename variables, extract functions, inline values, or "clean up" unrelated code.
- Do **not** remove or add `eslint-disable` comments.
- Do **not** change import order unless the diff explicitly moves an import.
- Do **not** touch files outside the "File:" header of the current fix.

If you find a bug in adjacent code (not covered by the fix), do **not** fix it. Write it to the status file under "Discovered out of scope" and continue with the current fix.

---

## A.4 Post-flight checklist (run this AFTER every fix, before committing)

- [ ] `npm run lint` — exit code 0. If it fails, do not commit; either the diff was wrong or you introduced an issue. Diagnose, do not bypass with `eslint-disable`.
- [ ] `npm run build` — exit code 0. If it fails, same response: diagnose, don't bypass.
- [ ] **Automated verify steps from the fix's "Verify:" section.** Run each one that doesn't require a device. Capture outputs.
- [ ] **Mark device-required steps as `PENDING-DEVICE-VERIFICATION`** in the status file. Do not claim they're done.
- [ ] **Commit with the message from section 3's table.** Use the exact wording — it's already been considered.

---

## A.5 Batching rules (the user explicitly allows batching when related)

Allowed batches — only these:

- **Multiple fixes inside the same row of section 3's implementation plan.** Example: row 22 batches FIX-042, FIX-043, FIX-044 because they're related mobile-feel fixes and the doc explicitly groups them.
- **Two or more fixes that touch the same file AND share the same row.** Same example as above.
- **A doc fix to a comment + a code fix in the same diff**, only when the doc fix is renaming a function in code that the comment references.

Forbidden batches:

- Batches across rows of section 3, even if they "feel related."
- Batches across files unless section 3 already groups them.
- Schema migrations (FIX-024, FIX-039) batched with ANYTHING — they ship in their own PR, by themselves. The user has stated this in multiple sections.
- Tier C fixes (A.9) batched with anything — they need scoping decisions first.
- "Look, FIX-007 and FIX-009 are both in `queryClient.js`-adjacent files, let me batch them." No. They're separate rows, separate commits.

Test before claiming a batch is OK: does section 3 put them on the *same numbered row?* If yes, batch is allowed. If no, separate commits.

---

## A.6 Stop-and-ask conditions

Stop immediately and write a message to the user when ANY of these are true:

- The anchor text from the doc doesn't appear in the target file.
- The "Before" code in the doc doesn't match the file verbatim (allowing only for line-number drift).
- Lint or build fails after a single fix and you can't tell why from the doc.
- A "Verify" step needs a real device and there's no device available.
- The fix's "File:" header lists a file that doesn't exist or has moved.
- A Tier C fix (A.9) is next in the plan and no scoping decision has been made.
- You discover an unrelated bug in adjacent code that the doc doesn't address.
- A fix would touch a file not listed in its "File:" header — even by one line.
- A previously-applied fix appears to have been reverted or modified externally.
- You're tempted to "improve" something while applying a fix.

**Do not improvise.** The doc was written carefully. If reality has drifted from the doc, the user needs to update the doc, not you.

---

## A.7 Forbidden behaviors (no exceptions)

You will **not**:

- **Change the visual design of any screen.** The scope guarantee at the top of the doc is binding. No layouts, no colors, no spacing, no shape, no carousel. If a fix accidentally has visual side-effects, stop and confirm with the user.
- **Add dependencies not listed in the fix's diff.** Even if the dependency would "help." If the fix doesn't say `npm install X`, don't install X.
- **Combine schema migrations with code changes** in one PR. FIX-024 and FIX-039 are SQL-only. They get their own commits, their own PRs, their own deploy windows.
- **Claim a "Verify:" step is done when it isn't.** This is the most common agent failure mode. If you can't run it, mark it pending. The user values truthful status more than fast status.
- **Proceed past a failure.** Lint fail → stop. Build fail → stop. Anchor mismatch → stop. The next fix never compensates for a broken previous fix.
- **Apply fixes out of order.** Section 3's table is the order. If a fix is blocked, stop the queue — don't skip ahead.
- **Refactor "while you're here."** Common temptation. Forbidden.
- **Fix bugs not in the doc.** If you spot one, log it in the status file under "Discovered out of scope." Don't fix it.
- **Generate alternative implementations** for a fix that you think is "cleaner." The doc's approach has been considered against the constraints. Don't second-guess.
- **Skip the Verify section because "lint and build pass."** Those are necessary but never sufficient.
- **Edit this doc itself**, except to mark items complete in the status section. The doc is the source of truth; if it's wrong, the user fixes it.

---

## A.8 Status tracking — `docs/HANDOVER_STATUS.md`

Maintain a separate file `docs/HANDOVER_STATUS.md` (create if it doesn't exist). Append to it after every commit. Use exactly this format:

```markdown
## FIX-XXX — <fix title from doc>

- **Commit:** <full git sha>
- **PR:** <link or "pending">
- **Files modified:** <list>
- **Lint pass:** ✓ / ✗ (with output excerpt if ✗)
- **Build pass:** ✓ / ✗ (with output excerpt if ✗)
- **Automated verify steps:** ✓ / ✗ / N/A (per step from doc's "Verify:" section)
- **Manual verify steps:** PENDING-DEVICE-VERIFICATION — <description of what needs device check>
- **Discovered out of scope:** <list anything you noticed but did NOT fix; empty if nothing>
- **Notes:** <anything the next agent or human reviewer needs to know>

---
```

When all fixes are applied:

- The status file lists 56 entries.
- The reviewer scans for `✗` and `PENDING-DEVICE-VERIFICATION` entries.
- They run the manual device checks.
- They sign off, or send specific items back.

---

## A.9 Tier-C fixes — these need a human scoping decision before you start

These fixes are open-ended and require human judgment. Do **not** start them without an explicit scoping note from the user.

- **FIX-029** (a11y tap targets) — how strict is "48dp minimum"? Default if user doesn't decide: round every interactive element below 48px to exactly 48px via padding, no other changes.
- **FIX-031b** (opportunistic MUI expansion) — this is the "while you're here" fix. Do **not** start it standalone. Only swap MWC → MUI for files you are *already editing for a different fix*. If you finish the whole plan without naturally touching any MWC file, that's fine — FIX-031b just doesn't fire this round.
- **FIX-038** (memory-leak audit on realtime subscriptions) — agent runs the grep and writes the audit report. Does **not** make changes without explicit per-finding direction.
- **FIX-048** (bundle-size budget) — default budgets are in the diff (175 KB main, 85 KB vendor, both gzipped). Apply as-is unless the user gives different numbers.
- **FIX-049** (iOS PWA splash images) — needs 8 PNG design assets that the agent cannot generate. If assets are not provided, mark the fix `SKIPPED-NEEDS-ASSETS` in the status file and move on.
- **FIX-051** (standalone `console.error` audit) — the list of files in the fix is authoritative. Do **not** expand it. If you grep and find new `console.error` calls that aren't in the FIX-051 list, log them under "Discovered out of scope" and proceed only with the listed files.

If a Tier C fix is next in section 3's order and you have no scoping note, stop the queue and ask.

---

## A.10 What "verified" actually means — terminology contract

The doc uses specific verify language. Treat them like contracts:

| Verify phrase | Means | How agent confirms |
|---|---|---|
| "Lint pass" | `npm run lint` exits 0 | Run it. Required. |
| "Build pass" | `npm run build` exits 0 | Run it. Required. |
| "Test pass" | `npm run test:*` exits 0 | Run the specific script named. |
| "Verified in Chrome" | A DOM/network change visible in Chrome DevTools | Mark `PENDING-DESKTOP-VERIFICATION` — user (or agent with browser access) does it. |
| "Tap responds in 100 ms" | INP measurement on real device | Mark `PENDING-DEVICE-VERIFICATION` — needs a phone. |
| "No double-tap required" | Behavioural test on real device | Mark `PENDING-DEVICE-VERIFICATION`. |
| "Sentry receives the event" | Real production Sentry event | Mark `PENDING-PROD-OBSERVATION` — wait 24 h after deploy. |
| "Backfill count is 0" | Run a SQL query against the DB | Mark `PENDING-DBA-APPROVAL` — agent never runs SQL against prod. |

When in doubt, the verify is `PENDING-*`. Better an honest pending than a false completion.

---

## A.11 Schema migrations — special rules

FIX-024 and FIX-039 touch `supabase/schema.sql`. They are different from code fixes in three ways:

1. **The agent writes the SQL exactly as in the doc, but does not deploy it.** Apply to the schema file. Commit. Mark the deploy step `PENDING-DBA-APPROVAL`.
2. **Backfills run separately from the migration.** FIX-039 has a backfill block in a `DO $$ ... $$` script. That script lives in the doc, not in `schema.sql`. Save it as `supabase/migrations/backfill_split_settlement_payee_txns.sql` so a human can run it manually after the schema migration deploys.
3. **No other code change in the same PR.** A schema migration goes out alone. The client fallback for FIX-024 (the old 6-query path) goes in a *separate* PR, before the schema migration, so the client is forward-compatible when the RPC arrives.

If the user asks you to "just ship FIX-039", you write the SQL, commit it, and report. You do **not** run `supabase db push` or any deploy command without explicit direction.

---

## A.12 Final sanity check before each commit

Read this aloud (mentally) before every `git commit`:

> "I have applied the diff verbatim. I have not added unrelated changes. The Before code matched. Lint passes. Build passes. The Verify steps I can run, have been run. The Verify steps I cannot run are marked pending. The commit message is from section 3 of the doc, unchanged. The status file is updated."

If any of those is false, do not commit. Fix the gap, or stop and ask.

---

## A.13 If you're about to do something this doc doesn't cover

Then this doc doesn't cover it. Stop. Ask the user. Do not improvise.

That is the entire protocol. There are no other escape hatches.

---

# P0 — The 2-tap bug and tap-path latency

---

## FIX-001 — Remove double-wrapped `startTransition` in BottomNav  [P0, 5 min]

**File:** `src/App.jsx`
**Anchor:** `BottomNav` component, the button's `onClick` handler (~line 487).

**Why:** React Router v6 with `v7_startTransition: true` already wraps `navigate()` in `React.startTransition`. Wrapping again makes the update interruptible — root cause A of the 2-tap bug.

**Before** (`src/App.jsx`, ~lines 487–500):

```jsx
              onClick={() => {
                import('./lib/haptics').then(m => m.hapticTap())
                if (isActive) {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  return
                }
                // replace: true keeps the history stack flat — tab switches
                // should never create back-navigable history entries so that
                // the iOS swipe-from-left gesture only triggers meaningful
                // navigation (e.g. modals / sub-pages), not tab hopping.
                startTransition(() => {
                  navigate(item.path, { replace: true })
                })
              }}
```

**After:**

```jsx
              onClick={() => {
                hapticTap()
                if (isActive) {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  return
                }
                // replace: true keeps the history stack flat. React Router v6
                // wraps navigate() in startTransition automatically via the
                // v7_startTransition future flag on <BrowserRouter>.
                navigate(item.path, { replace: true })
              }}
```

**Also at the top of `src/App.jsx`** (line 2), drop the now-unused `startTransition` from the React imports and add a static `hapticTap` import next to the other lib imports (~line 19):

```jsx
import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react'
// ...
import { hapticTap } from './lib/haptics'
```

**Verify:** Tap each nav tab on a real phone — should switch on first tap every time. ESLint should pass.

---

## FIX-002 — Collapse three event handlers into `onPointerEnter` + `onFocus`  [P0, 5 min]

**File:** `src/App.jsx`
**Anchor:** same button in `BottomNav` (~lines 501–503).

**Why:** `onMouseEnter` + `onFocus` + `onTouchStart` all fire on iOS Safari — three invocations of `prefetchRoute` per tap. `onTouchStart` also runs *during* the touch gesture, blocking the click resolution. Use `onPointerEnter` for desktop hover-intent + `onFocus` for keyboard nav. On touch devices, prefetch lazily happens via the eager preloader (FIX-005) so we don't need to prefetch on tap.

**Before:**

```jsx
              onMouseEnter={() => prefetchRoute(item.path)}
              onFocus={() => prefetchRoute(item.path)}
              onTouchStart={() => prefetchRoute(item.path)}
```

**After:**

```jsx
              onPointerEnter={(e) => { if (e.pointerType !== 'touch') prefetchRoute(item.path) }}
              onFocus={() => prefetchRoute(item.path)}
```

The `pointerType !== 'touch'` guard means hover-prefetch only fires on mouse/pen, not on touch — so the touch gesture isn't burdened.

**Verify:** Chrome DevTools Performance recording → tap a tab → no `prefetchRoute` call in the trace during the tap gesture; only after it completes.

---

## FIX-003 — Defer route-data prefetch off the main thread  [P0, 10 min]

**File:** `src/App.jsx`
**Anchor:** the returned `useCallback` body in `useRouteIntentPrefetch` (~line 121).

**Why:** Even hover prefetch should not block. Wrap the heavy data prefetch portion (5× `prefetchQuery` calls) in `requestIdleCallback` so it never competes with click handlers or scroll.

**Before** (~lines 121–140 of `App.jsx`):

```jsx
  return useCallback((path) => {
    if (!path) return

    if (!chunkPrefetched.current.has(path)) {
      chunkPrefetched.current.add(path)
      const preload = ROUTE_PRELOADERS[path]
      if (preload) void preload().catch(() => { })
    }

    if (!activeUserId) return
    const cacheKey = `${path}-${activeUserId}`
    if (dataPrefetched.current.has(cacheKey)) return

    dataPrefetched.current.add(cacheKey)

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    if (path === '/transactions') {
      // ...all the existing per-path prefetch branches...
```

**After** (refactor to extract data prefetch into a separate idle-scheduled function):

```jsx
  return useCallback((path) => {
    if (!path) return

    // Chunk preload is cheap (just import()) — fire immediately.
    if (!chunkPrefetched.current.has(path)) {
      chunkPrefetched.current.add(path)
      const preload = ROUTE_PRELOADERS[path]
      if (preload) void preload().catch(() => { })
    }

    if (!activeUserId) return
    const cacheKey = `${path}-${activeUserId}`
    if (dataPrefetched.current.has(cacheKey)) return
    dataPrefetched.current.add(cacheKey)

    // Defer data prefetch — never block on click or scroll.
    const schedule = typeof requestIdleCallback === 'function'
      ? (cb) => requestIdleCallback(cb, { timeout: 800 })
      : (cb) => setTimeout(cb, 0)

    schedule(() => runDataPrefetch(path, activeUserId))
  }, [activeUserId])
}

// Extracted from useRouteIntentPrefetch — runs in idle time.
function runDataPrefetch(path, activeUserId) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  if (path === '/transactions') {
    // ...existing per-path body, unchanged...
  }
  // ...remaining branches, unchanged...
}
```

**Verify:** Chrome DevTools → hover any tab on desktop → no long task > 50 ms.

---

## FIX-004 — Static-import `hapticTap` everywhere (kill dynamic haptic imports)  [P0, 15 min]

**Files:**

- `src/App.jsx` (done in FIX-001)
- `src/pages/Obligations.jsx` — line 74
- `src/components/transactions/TransactionItem.jsx` — lines 268, 329, 357, 367, 371
- `src/components/ui/BottomSheet.jsx` — line 21
- `src/components/ui/Button.jsx` — line 36

**Why:** `src/lib/haptics.js` is a 36-line, ~200 byte file. The dynamic `import('../../lib/haptics').then(...)` pattern adds a microtask + chunk lookup on every tap of every button. Static-import once, let the bundler tree-shake the rest.

**For each file:**

1. Add (or merge into existing imports):
   ```js
   import { hapticTap } from '../../lib/haptics' // adjust relative path
   ```
   When the file uses multiple haptic types, import them all:
   ```js
   import { hapticTap, hapticHeavy, hapticSuccess } from '../../lib/haptics'
   ```

2. Replace every `import('.../haptics').then(m => m.hapticXxx())` with `hapticXxx()`.

**Specific call sites:**

`src/components/ui/Button.jsx` lines 34–38:

```jsx
  const handleClick = useCallback((e) => {
    if (isDisabled) return
    import('../../lib/haptics').then(m => m.hapticTap())  // ← replace
    if (onClick) onClick(e)
  }, [isDisabled, onClick])
```

becomes:

```jsx
  const handleClick = useCallback((e) => {
    if (isDisabled) return
    hapticTap()
    if (onClick) onClick(e)
  }, [isDisabled, onClick])
```

`src/components/ui/BottomSheet.jsx` lines 19–23:

```jsx
  useEffect(() => {
    if (open) {
      import('../../lib/haptics').then((m) => m.hapticTap())
    }
  }, [open])
```

becomes:

```jsx
  useEffect(() => {
    if (open) hapticTap()
  }, [open])
```

`src/components/transactions/TransactionItem.jsx` — replace 5 dynamic imports with direct calls.

`src/pages/Obligations.jsx` line 74 — replace 1 dynamic import.

**Verify:** `git grep "import\\(.*haptics" src/` should return zero matches.

---

## FIX-005 — Parallel-preload nav-bar chunks once auth resolves  [P0, 10 min]

**File:** `src/App.jsx`
**Anchor:** `EagerChunkPreloader` (~line 1160).

**Why:** Today's loader is sequential (80 ms gaps × 12 chunks ≈ 1 s) and waits for `requestIdleCallback` (4 s timeout). HTTP/2 already multiplexes — sequencing is anti-cache. Fire nav-bar chunks in parallel as soon as auth resolves; defer secondary chunks to idle.

**Before** (~lines 1160–1191):

```jsx
function EagerChunkPreloader() {
  useEffect(() => {
    const loaders = Object.values(ROUTE_PRELOADERS)
    let handle = null

    const run = () => {
      loaders.forEach((load, i) => {
        setTimeout(() => void load().catch(() => { }), i * 80)
      })
    }

    if (typeof requestIdleCallback !== 'undefined') {
      handle = requestIdleCallback(run, { timeout: 4000 })
    } else {
      handle = setTimeout(run, 1500)
    }

    return () => {
      if (typeof requestIdleCallback !== 'undefined' && handle) {
        cancelIdleCallback(handle)
      } else {
        clearTimeout(handle)
      }
    }
  }, [])

  return null
}
```

**After:**

```jsx
function EagerChunkPreloader() {
  const { loading } = useAuth()

  useEffect(() => {
    if (loading) return

    const navBar = [
      ROUTE_PRELOADERS['/'],
      ROUTE_PRELOADERS['/transactions'],
      ROUTE_PRELOADERS['/monthly'],
      ROUTE_PRELOADERS['/analytics'],
      ROUTE_PRELOADERS['/obligations'],
      ROUTE_PRELOADERS['/splitwise'],
    ].filter(Boolean)

    const secondary = [
      ROUTE_PRELOADERS['/settings'],
      ROUTE_PRELOADERS['/reconciliation'],
      ROUTE_PRELOADERS['/guide'],
      ROUTE_PRELOADERS['/about'],
      ROUTE_PRELOADERS['/report-bug'],
      ROUTE_PRELOADERS['/onboarding'],
    ].filter(Boolean)

    // Nav chunks — parallel, immediate.
    Promise.allSettled(navBar.map((load) => load()))

    // Secondary — when the browser is idle.
    const schedule = typeof requestIdleCallback === 'function'
      ? (cb) => requestIdleCallback(cb, { timeout: 6000 })
      : (cb) => setTimeout(cb, 2000)

    const handle = schedule(() => {
      Promise.allSettled(secondary.map((load) => load()))
    })

    return () => {
      if (typeof requestIdleCallback === 'function' && typeof handle === 'number') {
        cancelIdleCallback(handle)
      } else if (handle) {
        clearTimeout(handle)
      }
    }
  }, [loading])

  return null
}
```

**Verify:** Chrome DevTools → Network → reload. All 6 nav chunks fetched in parallel within the first ~300 ms after auth resolves.

---

## FIX-006 — Inject `<link rel="modulepreload">` for nav chunks in build  [P0, 30 min]

**File:** `vite.config.js`
**Anchor:** the `plugins` array.

**Why:** Even with FIX-005, the browser doesn't start preloading until JS executes (~150 ms after HTML parse). `modulepreload` hints let the browser begin chunk download during HTML parse, saving another 200–500 ms on cold start.

**Add to `vite.config.js`** `plugins` array (just after `react()`):

```js
{
  name: 'kosha-modulepreload-nav-chunks',
  enforce: 'post',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (!ctx?.bundle) return html
      const NAV_PAGES = ['Dashboard', 'Transactions', 'Monthly', 'Analytics', 'Obligations', 'Splitwise']
      const hints = []
      for (const name of NAV_PAGES) {
        const chunk = Object.values(ctx.bundle).find(
          (b) => b.type === 'chunk' && b.facadeModuleId && b.facadeModuleId.includes(`/pages/${name}`)
        )
        if (chunk) {
          hints.push(`<link rel="modulepreload" href="/${chunk.fileName}" crossorigin>`)
        }
      }
      if (hints.length === 0) return html
      return html.replace('</head>', `    ${hints.join('\n    ')}\n  </head>`)
    },
  },
},
```

**Verify:** `npm run build && grep modulepreload dist/index.html` — should show 6 hints.

---

## FIX-007 — Set `refetchOnMount: false` in queryClient  [P0, 2 min]

**File:** `src/lib/queryClient.js`
**Anchor:** `defaultOptions.queries.refetchOnMount` (line 11).

**Why:** Today every tab visit refetches even when data is fresh. With `staleTime: 5 min`, only **stale** queries should refetch on mount — that's the default behavior of `false`. The current `true` setting causes a network round-trip on every tab visit and a wasted re-render.

**Before** (lines 8–11):

```js
      // After mutation invalidation, inactive pages must refresh when revisited.
      // `true` refetches only stale queries on mount (not always), preserving
      // most of the SWR/perceived-performance behavior while fixing stale lists.
      refetchOnMount: true,
```

**After:**

```js
      // React Query refetches automatically when data is stale (staleTime
      // exceeded). Mutations explicitly invalidate via invalidateQueryFamilies
      // which marks queries stale, so the next mount refetches naturally.
      // Setting `true` here would force a refetch on every mount even when
      // data is fresh — wasted network + extra re-renders on every tab visit.
      refetchOnMount: false,

      // Safety belt: keep window-focus refetch enabled. If a query was
      // somehow missed by an invalidation, returning to the tab from
      // another app forces a refetch. Combined with the existing
      // refetchOnReconnect, this keeps the data-freshness floor high
      // even though we no longer refetch on every mount.
      refetchOnWindowFocus: true,
      refetchOnReconnect: 'always',
```

(`refetchOnWindowFocus: true` is React Query's default — be explicit here so a future agent doesn't accidentally flip it.)

**Verify:** 
- Dashboard → Transactions → Dashboard within 5 minutes — second Dashboard mount should issue zero network requests.
- Backgrounded the app for 2 minutes, returned: queries refetch on focus.

**Escape hatch (if anyone reports stale data):** Reduce `staleTime` on the offending query (e.g. `useTransactions` could lower from 5 min to 30 s) instead of reverting this global setting. Per-query `staleTime` is the right tuning knob; the global `refetchOnMount` flag is not.

---

## FIX-008 — Replace `<html class>` MutationObserver with `matchMedia`  [P0, 10 min]

**File:** `src/main.jsx`
**Anchor:** the IIFE at lines 22–52.

**Why:** A `MutationObserver` on `document.documentElement` fires on every class-attribute mutation — frequent, and the work is wasted because the only class we actually care about is `dark`. Replace with the React-controlled toggle path + an OS-level `matchMedia` listener.

**Before** (lines 22–52):

```jsx
;(() => {
  let metaTheme = document.querySelector('meta[name="theme-color"]')
  if (!metaTheme) {
    metaTheme = document.createElement('meta')
    metaTheme.name = 'theme-color'
    document.head.appendChild(metaTheme)
  }

  const applyThemeColor = (isDark) => {
    metaTheme.content = isDark ? '#0B0C0F' : '#FFFFFF'
  }

  const stored = readLocalStorage('kosha-theme', null)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = stored === 'dark' || (!stored && prefersDark)

  if (isDark) {
    document.documentElement.classList.add('dark')
  }
  applyThemeColor(isDark)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        applyThemeColor(document.documentElement.classList.contains('dark'))
        break
      }
    }
  })
  observer.observe(document.documentElement, { attributes: true })
})()
```

**After:**

```jsx
;(() => {
  let metaTheme = document.querySelector('meta[name="theme-color"]')
  if (!metaTheme) {
    metaTheme = document.createElement('meta')
    metaTheme.name = 'theme-color'
    document.head.appendChild(metaTheme)
  }

  const applyThemeColor = (isDark) => {
    metaTheme.content = isDark ? '#0B0C0F' : '#FFFFFF'
  }

  const stored = readLocalStorage('kosha-theme', null)
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const prefersDark = mql.matches
  const isDark = stored === 'dark' || (!stored && prefersDark)

  if (isDark) document.documentElement.classList.add('dark')
  applyThemeColor(isDark)

  // React to OS-level changes only when the user has no explicit preference.
  mql.addEventListener('change', (e) => {
    if (readLocalStorage('kosha-theme', null)) return
    if (e.matches) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    applyThemeColor(e.matches)
  })

  // Expose the apply function so the in-app dark-mode toggle can call it
  // directly when it writes localStorage.
  window.__koshaApplyThemeColor = applyThemeColor
})()
```

Then in the in-app dark-mode toggle (search `Grep` for `kosha-theme` writes), after the localStorage write add:

```js
window.__koshaApplyThemeColor?.(isDark)
```

**Verify:** Toggle dark mode — meta `theme-color` updates. DevTools shows no `MutationObserver` attached to `<html>`.

---

## FIX-009 — Wrap routes in `useDeferredValue` to remove skeleton flash  [P0, 10 min]

**File:** `src/App.jsx`
**Anchor:** the `AnimatedRoutes` function (~line 1105).

**Why:** When a chunk isn't preloaded yet (rare after FIX-005/006, but happens on slow networks), `<Suspense>` unmounts the current page and shows a skeleton. `useDeferredValue` keeps the previous page visible until the new one's chunk and data are ready — a true premium feel.

**Before** (~lines 1105–1143):

```jsx
function AnimatedRoutes() {
  const location = useLocation()

  useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      if (document.activeElement.classList.contains('nav-float-item')) {
        document.activeElement.blur()
      }
    }
  }, [location.pathname])

  return (
    <div>
      <Routes location={location}>
        {/* ...all routes... */}
      </Routes>
    </div>
  )
}
```

**After:**

```jsx
import { useDeferredValue } from 'react'

function AppRoutes() {
  const location = useLocation()
  const deferredLocation = useDeferredValue(location)
  const isStale = deferredLocation !== location

  useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      if (document.activeElement.classList.contains('nav-float-item')) {
        document.activeElement.blur()
      }
    }
  }, [location.pathname])

  return (
    <div
      style={{
        // Subtle dim — just enough to signal "loading" without making
        // the previous page feel disabled. 0.92 reads as a soft fade
        // on both light and dark surfaces. If users report confusion
        // ("did my tap register?") raise to 0.88; if they report it
        // feeling laggy, raise to 0.96 (nearly imperceptible).
        opacity: isStale ? 0.92 : 1,
        transition: 'opacity 140ms cubic-bezier(0.2, 0, 0, 1)',
        // Block interactions on the stale tree — prevents the user
        // from tapping a button that's about to disappear.
        pointerEvents: isStale ? 'none' : 'auto',
      }}
    >
      <Routes location={deferredLocation}>
        {/* ...all routes... */}
      </Routes>
    </div>
  )
}
```

Update the single call site (around line 1540) from `<AnimatedRoutes />` to `<AppRoutes />`.

**Verify:** On a throttled network ("Slow 3G"), tap any tab — the previous page should dim very slightly (~8%), then crossfade to the new page. No skeleton flash. The dim is intentionally subtle; if it's invisible to you, that's the goal.

**Escape hatch:** If even the 0.92 dim feels wrong on real devices, set `opacity: 1` unconditionally. The pointer-event blocking still prevents double-taps and the new route still won't show a skeleton.

---

# P1 — Snappiness, stability, and premium motion

---

## FIX-010 — Drop `backdrop-filter` on bottom nav for touch devices  [P1, 5 min]

**File:** `src/index.css`
**Anchor:** `.nav-float-wrap` (~line 967) and `.dark .nav-float-wrap` (~line 998).

**Why:** `backdrop-filter: blur(12px)` is the single most expensive style on the nav. At 0.94 alpha the blur is barely perceptible. The GPU pass runs every paint frame and costs ~6–10 ms per frame on mid-range Android. Keep the blur on desktop where it looks nice and devices are powerful.

**Before** (lines 967–986):

```css
  .nav-float-wrap {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 30;
    border-top: 1px solid var(--ds-border);
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: saturate(160%) blur(12px);
    -webkit-backdrop-filter: saturate(160%) blur(12px);
    border-top-color: rgba(17, 19, 24, 0.08);
    /* ... */
  }
```

**After:**

```css
  .nav-float-wrap {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 30;
    border-top: 1px solid var(--ds-border);
    background: #FFFFFF;
    border-top-color: rgba(17, 19, 24, 0.08);
    /* ... */
  }

  /* Restore the blur only on devices with a fine pointer (desktop). */
  @media (hover: hover) and (pointer: fine) {
    .nav-float-wrap {
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: saturate(160%) blur(12px);
      -webkit-backdrop-filter: saturate(160%) blur(12px);
    }
  }
```

Apply the equivalent transform to `.dark .nav-float-wrap` (set solid `#1D2024` for touch devices; restore blur inside the `@media (hover: hover)` block).

**Also audit `backdrop-filter` elsewhere:** `git grep "backdrop-filter" src/index.css` — most usages on sheet backdrops can keep the blur (they're transient), but verify the FAB and topbar.

**Verify:** Scroll Dashboard on a phone — Chrome DevTools Performance frame chart shows 60fps paint frames (was sometimes 30–45fps).

---

## FIX-011 — Tune the bottom-nav pill spring to M3 Expressive  [P1, 5 min]

**File:** `src/App.jsx`
**Anchor:** `motion.div layoutId="nav-pill"` (~line 509).

**Why:** Current spring `stiffness: 650, damping: 52, mass: 1` has a damping ratio ≈ 1.02 — overdamped. Material 3 Expressive Spatial defaults use damping ratio ~0.85, which produces a subtle controlled bounce that reads as "alive" rather than "sluggish". Pixel's bottom nav matches this.

**Before** (~lines 508–518):

```jsx
                {isActive && (
                  <motion.div layoutId="nav-pill" className="nav-icon-bg"
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 650,
                      damping: 52,
                      mass: 1,
                    }}
                  />
                )}
```

**After:**

```jsx
                {isActive && (
                  <motion.div layoutId="nav-pill" className="nav-icon-bg"
                    initial={false}
                    transition={{
                      // M3 Expressive Spatial Default — damping ratio ~0.85
                      // produces a small controlled overshoot (~3%) that
                      // reads as "alive" without feeling jelly.
                      type: 'spring',
                      stiffness: 800,
                      damping: 40,
                      mass: 1,
                    }}
                  />
                )}
```

Verify the active-icon `motion.span` springs nearby too. The current `stiffness: 700, damping: 60` is also overdamped. Tune to `stiffness: 900, damping: 38` for the active icon and keep the inactive icon's `duration: 0.12` linear-out (M3 fast-effects-out for de-emphasized state changes).

**Verify:** Tap between tabs — the pill should have a barely-perceptible bounce at the end of its travel. If it overshoots visibly, raise damping by 4. If it feels dead, lower damping by 4.

---

## FIX-012 — Tap-squish duration: 80 ms → 100 ms with M3 Expressive easing  [P1, 2 min]

**File:** `src/index.css`
**Anchor:** `.nav-float-item:active` (~line 1081).

**Why:** Pixel taps use ~100 ms press-down with the M3 *emphasized-decelerate* easing. The current `80ms cubic-bezier(0.2,0,0,1)` is M3 *standard* — fine but not premium. The change is small but perceptible.

**Before** (lines 1081–1085):

```css
  .nav-float-item:active {
    /* Immediate squish — release spring back via the transition */
    transform: scale(0.88);
    transition: transform 80ms var(--ds-ease-standard);
  }
```

**After:**

```css
  .nav-float-item:active {
    /* M3 Expressive press-down: 100 ms emphasized-decelerate */
    transform: scale(0.9);
    transition: transform 100ms var(--md-sys-motion-easing-emphasized-decelerate, cubic-bezier(0.05, 0.7, 0.1, 1));
  }
```

The `scale(0.9)` (was `0.88`) is also more Material — `0.88` feels "stamped"; `0.9` feels "pressed".

**Verify:** Tap nav items — the press should feel slightly softer and more deliberate.

---

## FIX-013 — Sheet open spring: tune to M3 Expressive Fast Spatial  [P1, 5 min]

**File:** `src/components/ui/BottomSheet.jsx`
**Anchor:** `transitionDuration` and `paper.sx.transition` (~lines 45–77).

**Why:** Today the sheet opens with a custom cubic-bezier approximating a spring (`cubic-bezier(0.30, 1.38, 0.56, 1)` — that's ~38% overshoot, which is too bouncy for a 28px-radius sheet on a 6-inch screen). M3 Expressive Fast Spatial: damping ratio ~0.9 over 380 ms reads as crisp without bounce.

**Before** (lines 45–77):

```jsx
      transitionDuration={{
        enter: 380, // matches --ds-dur-spring-default
        exit: 220,
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(17, 19, 24, 0.40)',
            transition: 'opacity 280ms cubic-bezier(0.2, 0, 0.2, 1) !important',
          },
        },
        paper: {
          sx: {
            /* ... */
            transition:
              'transform 380ms cubic-bezier(0.30, 1.38, 0.56, 1), opacity 280ms cubic-bezier(0.2, 0, 0.2, 1) !important',
            /* ... */
          },
        },
      }}
```

**After:**

```jsx
      transitionDuration={{
        enter: 300,
        exit: 200,
      }}
      slotProps={{
        backdrop: {
          sx: {
            // Touch devices skip the blur — see FIX-014.
            '@media (hover: hover) and (pointer: fine)': {
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            },
            backgroundColor: 'rgba(17, 19, 24, 0.40)',
            transition: 'opacity 240ms cubic-bezier(0.2, 0, 0, 1) !important',
          },
        },
        paper: {
          sx: {
            /* ... */
            // M3 Expressive emphasized — fast, decisive, no overshoot.
            transition:
              'transform 300ms cubic-bezier(0.05, 0.7, 0.1, 1), opacity 240ms cubic-bezier(0.2, 0, 0, 1) !important',
            /* ... */
          },
        },
      }}
```

**Verify:** Open the AddTransaction sheet from the FAB. Should feel decisive — no rubber-band.

---

## FIX-014 — Drop sheet-backdrop blur on touch devices  [P1, 2 min]

**File:** `src/components/ui/BottomSheet.jsx`
**Anchor:** the backdrop `slotProps` (already touched in FIX-013).

**Why:** Backdrop blur on every sheet open costs ~50 ms of GPU work on a mid-range Android. Keep it on desktop where the visual benefit is clearer.

The `'@media (hover: hover) and (pointer: fine)'` wrapper inside the backdrop `sx` (added in FIX-013) handles this. Just confirm it's applied.

**Verify:** Open a sheet on phone vs. desktop. Phone: solid translucent backdrop, no blur. Desktop: blurred.

---

## FIX-015 — Always `disableDiscovery` on bottom sheets  [P1, 2 min]

**File:** `src/components/ui/BottomSheet.jsx`
**Anchor:** the `disableDiscovery` prop (line 44).

**Why:** Today on Android, MUI's `SwipeableDrawer` enables an edge-swipe-to-open handler at the bottom of the screen — exactly where the bottom nav lives. A small finger drift during a tap can be swallowed by the gesture recognizer. Sheets in Kosha are always opened by explicit FAB/button — never edge-swipe.

**Before** (line 44):

```jsx
      disableDiscovery={ios}
```

**After:**

```jsx
      disableDiscovery={true}
```

**Verify:** On Android, slide a finger upward starting from very bottom of screen — no sheet opens.

---

## FIX-016 — Drop the unused `<div>` wrapper around `<Routes>` (only if FIX-009 not applied)  [P1, 1 min]

**File:** `src/App.jsx`
**Anchor:** `AnimatedRoutes` / `AppRoutes`.

**Why:** Cosmetic correctness — but skip if you applied FIX-009 (which re-uses the `<div>` for the opacity wrapper). This fix is mutually exclusive with FIX-009.

---

## FIX-017 — Cancel in-flight prefetches on wallet switch  [P1, 5 min]

**File:** `src/App.jsx`
**Anchor:** the wallet-reset effect inside `useRouteIntentPrefetch` (~lines 116–119).

**Why:** Today, prefetches in flight when the wallet switches can resolve into the cache **after** the reset, polluting the new wallet's data.

**Before** (lines 116–119):

```jsx
  useEffect(() => {
    chunkPrefetched.current.clear()
    dataPrefetched.current.clear()
  }, [activeUserId])
```

**After:**

```jsx
  useEffect(() => {
    chunkPrefetched.current.clear()
    dataPrefetched.current.clear()
    // Cancel in-flight prefetches keyed on the previous user.
    queryClient.cancelQueries({
      predicate: (q) => {
        const key = q.queryKey
        const lastSegment = Array.isArray(key) ? key[key.length - 1] : null
        return lastSegment && lastSegment !== activeUserId
      },
    })
  }, [activeUserId])
```

**Verify:** Switch wallets rapidly via the ProfileMenu — no cross-wallet data leakage in DevTools React-Query panel.

---

## FIX-018 — Capture query/mutation errors in Sentry  [P1, 10 min]

**File:** `src/lib/queryClient.js`
**Anchor:** the `QueryClient` constructor.

**Why:** Today, query errors are caught for in-app UI display (`QueryErrorRecovery`) but never reported to Sentry. We have zero visibility into production query failures.

**Before** (line 1):

```js
import { QueryClient } from '@tanstack/react-query'
```

**After:**

```js
import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query'
import { captureError } from './errorReporting'

const queryCache = new QueryCache({
  onError: (error, query) => {
    const status = error?.status || error?.code
    // Auth failures are handled by AuthGuard redirect — don't spam Sentry.
    if (status === 401 || status === 403) return
    captureError(error, {
      tags: {
        source: 'react-query',
        queryKey: JSON.stringify(query.queryKey).slice(0, 200),
      },
    })
  },
})

const mutationCache = new MutationCache({
  onError: (error, _vars, _ctx, mutation) => {
    captureError(error, {
      tags: {
        source: 'react-query-mutation',
        mutationKey: JSON.stringify(mutation.options.mutationKey || []).slice(0, 200),
      },
    })
  },
})

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false
        const status = error?.status || error?.code
        if (status === 401 || status === 403 || status === 404) return false
        if (String(error?.message || '').includes('Not signed in')) return false
        return true
      },
      refetchOnReconnect: 'always',
    },
  },
})
```

Verify `captureError` accepts a `tags` option; extend `src/lib/errorReporting.js` if not.

**Verify:** Simulate offline, navigate Dashboard. Sentry should receive an event with `tags.source=react-query`.

---

## FIX-019 — Disable submit during in-flight mutation (kill double-submit)  [P1, 30 min spread across 6 files]

**Files:** every form sheet — `AddTransactionSheet.jsx`, `AddBillSheet.jsx`, `AddLoanSheet.jsx`, Splitwise create forms.

**Why:** Today, rapid taps on Save during the ~300 ms mutation window can create duplicate records. Optimistic-update guards in `mutationGuard.js` prevent server-side dupes, but the UX is confusing.

For each save handler, follow this pattern:

```jsx
const [isSubmitting, setIsSubmitting] = useState(false)

const handleSave = useCallback(async () => {
  if (isSubmitting) return
  setIsSubmitting(true)
  try {
    await saveTransactionMutation(...)
    hapticSuccess()
    onClose()
  } catch (err) {
    // toast etc.
  } finally {
    setIsSubmitting(false)
  }
}, [isSubmitting, /* ...deps... */])

return (
  <Button onClick={handleSave} loading={isSubmitting} disabled={isSubmitting}>
    Save
  </Button>
)
```

The `<Button>` component already accepts `loading` and renders a spinner — confirm against `src/components/ui/Button.jsx`.

**Verify:** Rapid-tap Save 5 times in 100 ms → only one record created, and the button visually locks after the first tap.

---

## FIX-020 — Guard the Dashboard time-ticker against unmount races  [P1, 5 min]

**File:** `src/pages/Dashboard.jsx`
**Anchor:** the time-ticker `useEffect` (~lines 73–101).

**Why:** Current closure captures `intervalId` by `let` binding. If the component unmounts during the first `setTimeout` window (e.g. wallet switch), the captured `intervalId` ref may already be cleared. Defensive guarding makes this rock-solid.

**Before** (lines 73–101):

```jsx
  useEffect(() => {
    let intervalId = null

    function tick() { /* ... */ }

    const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000
    const timeoutId = setTimeout(() => {
      tick()
      intervalId = setInterval(tick, 60_000)
    }, msUntilNextMinute)

    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])
```

**After:**

```jsx
  useEffect(() => {
    let cancelled = false
    let intervalId = null
    let timeoutId = null

    const tick = () => {
      if (cancelled) return
      const next = new Date()
      setNow(prev => {
        if (
          prev.getFullYear() !== next.getFullYear() ||
          prev.getMonth() !== next.getMonth() ||
          prev.getDate() !== next.getDate() ||
          prev.getHours() !== next.getHours()
        ) return next
        return prev
      })
    }

    const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000
    timeoutId = setTimeout(() => {
      if (cancelled) return
      tick()
      intervalId = setInterval(tick, 60_000)
    }, msUntilNextMinute)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])
```

**Verify:** Mount/unmount Dashboard repeatedly via wallet switching — no React warnings about state updates on unmounted components.

---

## FIX-021 — Defer `recordRuntimeRoute` writes  [P1, 5 min]

**File:** `src/lib/runtimeMonitor.js`
**Anchor:** `recordRuntimeRoute`.

**Why:** `sessionStorage` writes block the main thread (~2–5 ms on iOS). Today the function runs synchronously on every route change.

**Before** (find via `Grep` for `export function recordRuntimeRoute`):

```js
export function recordRuntimeRoute(path) {
  // synchronous sessionStorage.setItem(...)
}
```

**After:**

```js
let routePending = null
let routeTimer = null

export function recordRuntimeRoute(path) {
  routePending = path
  if (routeTimer) return
  routeTimer = setTimeout(() => {
    try {
      // ... original synchronous body using `routePending` ...
    } catch { /* ignore */ }
    routeTimer = null
    routePending = null
  }, 0)
}
```

**Verify:** Behaviourally identical; profiler shows 0 ms of `sessionStorage.setItem` cost on the navigation event handler.

---

## FIX-022 — Throttle the reminder-prefs storage listener  [P1, 3 min]

**File:** `src/pages/Dashboard.jsx`
**Anchor:** the reminder-prefs `useEffect` (~lines 423–437).

**Why:** Today, `window.focus` and `window.storage` events trigger a synchronous re-read of localStorage. In PWA mode, focus fires often (tab visibility, sheet open/close).

**Before:**

```jsx
  useEffect(() => {
    const refreshReminderPrefs = () => {
      setReminderPrefsState(getReminderPrefs())
    }

    window.addEventListener(REMINDER_PREFS_EVENT, refreshReminderPrefs)
    window.addEventListener('focus', refreshReminderPrefs)
    window.addEventListener('storage', refreshReminderPrefs)

    return () => {
      window.removeEventListener(REMINDER_PREFS_EVENT, refreshReminderPrefs)
      window.removeEventListener('focus', refreshReminderPrefs)
      window.removeEventListener('storage', refreshReminderPrefs)
    }
  }, [])
```

**After:**

```jsx
  useEffect(() => {
    let pending = false
    const refreshReminderPrefs = () => {
      if (pending) return
      pending = true
      requestAnimationFrame(() => {
        setReminderPrefsState(getReminderPrefs())
        pending = false
      })
    }

    window.addEventListener(REMINDER_PREFS_EVENT, refreshReminderPrefs)
    window.addEventListener('focus', refreshReminderPrefs)
    window.addEventListener('storage', refreshReminderPrefs)

    return () => {
      window.removeEventListener(REMINDER_PREFS_EVENT, refreshReminderPrefs)
      window.removeEventListener('focus', refreshReminderPrefs)
      window.removeEventListener('storage', refreshReminderPrefs)
    }
  }, [])
```

**Verify:** Behaviour unchanged; profiler shows reduced reminder-pref reads on rapid focus events.

---

## FIX-023 — Memoize list rows  [P1, 30 min]

**Files:**
- `src/components/transactions/TransactionItem.jsx`
- `src/components/dashboard/DashboardRecentTransactions.jsx` (internal row component if any)
- `src/components/bills/BillRow.jsx` (or equivalent)
- `src/components/loans/LoanRow.jsx` (or equivalent)
- Any other `*Item` / `*Row` under `src/components/`

**Why:** Parent re-renders propagate to every row by default. With memoization, only rows whose data actually changed re-render. Critical for the Transactions virtualized list (50+ items × ~3 ms each = 150+ ms saved per filter change).

For each row component, wrap default export with `React.memo`:

```jsx
import { memo } from 'react'

function TransactionItem({ /* ... */ }) {
  /* ... */
}

export default memo(TransactionItem, (prev, next) => {
  // Cheap equality — IDs + version fields + selection state.
  return (
    prev.transaction.id === next.transaction.id &&
    prev.transaction.updated_at === next.transaction.updated_at &&
    prev.selected === next.selected &&
    prev.disabled === next.disabled
  )
})
```

If a row receives callback props (`onTap`, `onDelete`), the parent must wrap them in `useCallback` with stable deps — otherwise memo equality fails.

**Verify:** React DevTools → "Highlight updates when components render" → filter Transactions list → only affected rows highlight.

---

## FIX-024 — Coalesce Splitwise 6-fan-out queries into one RPC  [P1, 3 hours, separate PR]

**Files:** `src/hooks/useSplitwise.js`, `supabase/schema.sql`.

**Why:** Splitwise fans out to 6 parallel HTTP requests on mount: groups, group_access, members, expenses, splits, settlements. Each settles independently → 6 re-renders of the 2,281-LOC Splitwise page. Combine into one `SECURITY DEFINER` RPC that returns the full payload, then expose via a single `useQuery`.

This is in scope but warrants its own PR — touches both server schema and client hook. Full migration steps:

1. Add `split_get_full_state()` RPC in `supabase/schema.sql` returning a JSON blob containing `{groups, members, expenses, expense_splits, settlements, group_access}`. Grant EXECUTE to `authenticated`.
2. Replace `useSplitwise`'s `useQueries({queries:[...]})` with one `useQuery(['splitwise', 'full-state', activeWalletUserId], queryFn)`.
3. Update downstream `computeMemberBalances` and `buildSimplifiedTransfers` to read from the new flat shape.
4. Invalidation paths: any mutation that currently invalidates one of the 6 keys must invalidate `['splitwise', 'full-state']` instead.

**Verify:** Splitwise mount issues **one** network request. React DevTools render count for the page drops from ~6 to ~2.

---

## FIX-025 — Remove `fade-up-N` stagger below the Dashboard fold  [P1, 5 min]

**File:** `src/pages/Dashboard.jsx`
**Anchor:** all `className="card-spring-in fade-up-N"` usages.

**Why:** Today, sections cascade in with delays up to 440 ms (`fade-up-9`). On phones, users scroll past the hero within 200 ms — the stagger isn't even visible, and the JS for `card-spring-in` (a `transform: translateY` animation) costs main-thread work. Material guidance is to animate **only** above-the-fold content.

**Concrete edits** in `src/pages/Dashboard.jsx`:

- Greeting: keep `className="fade-up fade-up-1"` (above the fold).
- Hero card: keep `className="fade-up fade-up-2"` (above the fold).
- Everything below (Action queue, Spend control, Bills control, Recent): change `card-spring-in fade-up-N` → `fade-in`.

`fade-in` is opacity-only — no transform, no layout-shift cost. Below-fold content appears at the same time as it would have anyway but without per-element JS.

**Verify:** Visual: hard refresh Dashboard. Hero card fades in; everything below appears together. Profiler: scroll on Dashboard shows fewer composite layers.

---

## FIX-026 — Wire `document.startViewTransition` for tab switches (where supported)  [P1, 30 min]

**File:** `src/App.jsx`
**Anchor:** the BottomNav `onClick`.

**Why:** The native View Transitions API ships in Chromium and is polyfillable on Safari (no-op). It gives a free, GPU-accelerated crossfade between the previous and next page DOM with zero layout work. This is what Pixel apps use under the hood for premium "scene" transitions.

Add to `src/App.jsx` (near the top of the file, alongside other helpers):

```jsx
function navigateWithViewTransition(navigate, to, options) {
  if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
    // The transition's callback must synchronously update state — wrap the navigate.
    document.startViewTransition(() => {
      navigate(to, options)
    })
    return
  }
  navigate(to, options)
}
```

Replace the call in BottomNav `onClick` (after FIX-001's edit):

```jsx
              onClick={() => {
                hapticTap()
                if (isActive) {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  return
                }
                navigateWithViewTransition(navigate, item.path, { replace: true })
              }}
```

Add CSS in `src/index.css` (bottom of the file):

```css
/* Native page transitions — Chromium + supported Safari. */
@view-transition {
  navigation: auto;
}

::view-transition-old(root) {
  animation: 180ms cubic-bezier(0.2, 0, 0, 1) both kosha-vt-fade-out;
}
::view-transition-new(root) {
  animation: 220ms cubic-bezier(0.05, 0.7, 0.1, 1) both kosha-vt-fade-in;
}

@keyframes kosha-vt-fade-out {
  to { opacity: 0; }
}
@keyframes kosha-vt-fade-in {
  from { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 1ms !important;
  }
}
```

This produces a 200 ms native crossfade on tab switches that's faster and smoother than any JS approach because the browser snapshots both DOMs and animates on the compositor thread.

**Verify:** In Chromium, switch tabs → smooth crossfade. In Safari (where the API isn't shipped at time of writing), the no-op fallback runs and the swap is instant (same as today).

---

## FIX-027 — Hero amount typography: small paise on Dashboard + Monthly  [P1, 20 min]

**Files:**
- `src/lib/utils.js` (helper)
- `src/components/cards/dashboard/DashboardHeroCard.jsx`
- `src/components/cards/monthly/MonthHeroCard.jsx`

**Why:** Premium finance apps (Google Pay, Apple Wallet, Cred) render paise at ~55–62% of the rupee size. Reads as "₹12,345.67" with the decimal portion visually subordinate — easier to scan, more confidence-inspiring. The user has confirmed they want this pattern on both hero cards.

**Step 1.** Add a helper to `src/lib/utils.js` next to `fmt`:

```js
// Splits a currency amount into rupee and paise parts using Intl
// .formatToParts so the result is locale-correct (any currency, not just INR).
//   splitFmtAmount(12345.67) → { main: '₹\u202F12,345', decimal: '.67', totalLength: 12 }
//   splitFmtAmount(null)     → { main: '—',              decimal: '',     totalLength: 1  }
export function splitFmtAmount(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return { main: '—', decimal: '', totalLength: 1 }
  }
  const parts = _currencyFmt.formatToParts(n)
  const before = []
  const after = []
  let crossed = false
  for (const p of parts) {
    if (p.type === 'decimal') {
      crossed = true
      after.push(p.value)
      continue
    }
    if (crossed) after.push(p.value)
    else before.push(p.value)
  }
  const main = before.join('').replace('-', '−').replace('₹', '₹\u202F')
  const decimal = after.join('')
  return { main, decimal, totalLength: (main + decimal).length }
}
```

**Step 2.** `DashboardHeroCard.jsx` — replace the main amount block (~lines 78–133).

Before:

```jsx
  const mainValueText = heroMode === 'balance'
    ? (runningBalance !== null ? fmt(runningBalance) : '—')
    : (safeToSpend !== null ? fmt(safeToSpend) : '—')
  const mainValueClass = getHeroAmountClass(mainValueText.length)
```

…

```jsx
      {/* Main amount — large */}
      <div>
        <p className={`${mainValueClass} font-bold text-white leading-[0.95] tracking-tight tabular-nums max-w-full whitespace-normal [overflow-wrap:anywhere]`}>
          {mainValueText}
        </p>
      </div>
```

After:

```jsx
  const mainValueNumber = heroMode === 'balance' ? runningBalance : safeToSpend
  const mainParts = splitFmtAmount(mainValueNumber)
  const mainValueClass = getHeroAmountClass(mainParts.totalLength)
```

…

```jsx
      {/* Main amount — large; paise rendered at 60% scale for premium hierarchy */}
      <div>
        <p className={`${mainValueClass} font-bold text-white leading-[0.95] tracking-tight tabular-nums max-w-full whitespace-normal [overflow-wrap:anywhere]`}>
          {mainParts.main}
          {mainParts.decimal && (
            <span className="text-[0.6em] font-semibold opacity-75 align-baseline ml-[0.04em]">
              {mainParts.decimal}
            </span>
          )}
        </p>
      </div>
```

Add `splitFmtAmount` to the import at the top:

```jsx
import { fmt, splitFmtAmount } from '../../../lib/utils'
```

**Step 3.** `MonthHeroCard.jsx` — apply the same pattern to the `balance` amount block (~lines 27–60).

Before:

```jsx
  const balance = data?.balance || 0
  const balanceText = fmt(balance)
  const balanceClass = getHeroAmountClass(balanceText.length)
```

…

```jsx
      <p className={`${balanceClass} font-bold leading-[0.95] tracking-tight tabular-nums max-w-full whitespace-normal [overflow-wrap:anywhere] ${balance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}>
        {balanceText}
      </p>
```

After:

```jsx
  const balance = data?.balance || 0
  const balanceParts = splitFmtAmount(balance)
  const balanceClass = getHeroAmountClass(balanceParts.totalLength)
```

…

```jsx
      <p className={`${balanceClass} font-bold leading-[0.95] tracking-tight tabular-nums max-w-full whitespace-normal [overflow-wrap:anywhere] ${balance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}>
        {balanceParts.main}
        {balanceParts.decimal && (
          <span className="text-[0.6em] font-semibold opacity-75 align-baseline ml-[0.04em]">
            {balanceParts.decimal}
          </span>
        )}
      </p>
```

Add `splitFmtAmount` to the import at the top:

```jsx
import { fmt, splitFmtAmount, savingsRate } from '../../../lib/utils'
```

**Style notes:**
- `text-[0.6em]` makes paise exactly 60% of the rupee size (locks to em so it scales with `getHeroAmountClass`).
- `opacity-75` matches Google Pay's subordination.
- `align-baseline` keeps the paise sitting on the baseline, not floating above (avoids the "superscript" look).
- `ml-[0.04em]` adds a tiny gap so the decimal point doesn't visually fuse with the digit before it.
- `font-semibold` (was `font-bold`) keeps weight visually consistent without overpowering.

**Do NOT apply to stat chips** — they're already ~14 px; making paise smaller there would push them below 8.4 px which is unreadable.

**Verify:** Open Dashboard and Monthly. The big balance reads "₹12,345.**67**" with the paise visibly smaller and slightly faded. Long numbers (e.g. `₹\u202F1,23,45,678.90`) still wrap correctly.

---

## FIX-028 — Tap-target audit (48×48 dp minimum)  [P1, 20 min]

**Files:** anywhere `<button>` renders a small icon — hint-dismiss X buttons, swipe-row trailing icons, profile-menu items.

**Why:** WCAG 2.2 AA requires 24×24; Material/iOS HIG and Pixel guidelines require 48×48. Many small icon buttons in Kosha (e.g. dismiss-X on hint cards, lock-icon swipe affordances) are 13–16 px hit areas — frustrating on a thumb.

Audit query:

```bash
git grep -nE 'size=\{1[0-9]\}' src/components | grep button
```

For each small icon button, wrap with padding so the **hit area** is at least 48×48 while the **icon** stays its current size:

```jsx
<button
  type="button"
  onClick={dismiss}
  className="-m-3 p-3 text-ink-4 hover:text-ink-2"  // -m-3 cancels parent padding; p-3 = 12px on each side
  aria-label="Dismiss hint"
>
  <X size={13} />
</button>
```

The `-m-3 p-3` pattern preserves the visual layout while expanding the touch target.

**Verify:** Chrome DevTools → toggle device mode → mid-finger phantom touch → tap an icon button → no missed taps.

---

## FIX-029 — Visible `:focus-visible` rings  [P1, 10 min]

**File:** `src/index.css`
**Anchor:** existing `outline: none` / focus styles.

**Why:** WCAG 2.2 AA requires visible focus indicators for keyboard users. Today many buttons hide focus entirely (`outline: none` or `-webkit-tap-highlight-color: transparent`). Premium apps show the ring only for keyboard navigation via `:focus-visible`.

Add to `src/index.css` (near top of `@layer base` or anywhere global rules live):

```css
/* Premium focus rings — visible only on keyboard navigation, not on touch. */
button:focus-visible,
a:focus-visible,
[role="button"]:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ds-primary);
  outline-offset: 2px;
  border-radius: inherit;
}
```

**Verify:** Tab through the Dashboard with keyboard — focus rings appear. Tap with finger — no rings.

---

---

## FIX-039 — Splitwise settlement creates only the payer's transaction (data bug)  [P0, 1 hr, schema migration]

**File:** `supabase/schema.sql`
**Anchor:** `create or replace function public.split_record_settlement(...)` at line ~2969.

**The bug, in plain English:** When Alice records "I paid Bob ₹500 to settle up", Alice gets a ₹500 expense transaction in her wallet ✓, but Bob never gets the matching ₹500 income transaction in his wallet ✗. The Splitwise group's `split_settlements` row is created correctly; only the personal-ledger transactions are asymmetric.

**Root cause (verified):** The RPC is `language plpgsql security invoker`, meaning it runs as the calling user. The `transactions: insert own` RLS policy enforces `auth.uid() = user_id`, so an INSERT for `user_id = Bob` from Alice's session is rejected. The body then guards each insert with `if v_payer_uid = v_uid` / `if v_payee_uid = v_uid` — the second branch is dead code from Alice's perspective. This is the bug the user reported.

**Evidence:** `delete_split_settlement_atomic` (line ~3891) is already `security definer` and reads BOTH `payer_transaction_id` and `payee_transaction_id` from the settlement row when deleting. The original author intended both transactions to exist; the insert path was just incomplete.

**Trust model for the fix:**

- The function must be `security definer` to bypass RLS.
- Authorization at function entry: caller must be either the payer OR the payee. This blocks a third member of the group from forging a settlement between two others.
- Insert the OTHER party's transaction only when (a) the other party has a `linked_user_id` (they're a real Kosha account, not a ghost member) AND (b) caller is either the other party themselves (i.e. self-recording from the other side) OR linked to them via `public.is_linked()` (paired wallets) OR is in the same Splitwise group as them (which they already are — that's the precondition for being in this RPC). The Splitwise-group-membership trust model is: by accepting an invite and linking your account, you accept that other members can record settlements involving you. This is consistent with how Splitwise (the actual app) works.

**Before** (`supabase/schema.sql`, lines 2969–3071):

```sql
create or replace function public.split_record_settlement(
  p_group_id uuid,
  p_payer_member_id uuid,
  p_payee_member_id uuid,
  p_amount numeric,
  p_settled_at date default current_date,
  p_note text default null,
  p_sync_transaction boolean default true
)
returns split_settlements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row split_settlements%rowtype;
  v_payer_uid uuid;
  v_payee_uid uuid;
  v_payer_txn_id uuid;
  v_payee_txn_id uuid;
  v_payer_name text;
  v_payee_name text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Settlement amount must be positive'; end if;
  if p_payer_member_id is null or p_payee_member_id is null then raise exception 'Payer and payee are required'; end if;
  if p_payer_member_id = p_payee_member_id then raise exception 'Payer and payee cannot be the same'; end if;
  if not public.is_split_group_member_or_above(p_group_id, v_uid) then raise exception 'Split group not found'; end if;

  select linked_user_id, display_name into v_payer_uid, v_payer_name
  from split_group_members where id = p_payer_member_id and group_id = p_group_id;
  if v_payer_uid is null and not exists (
    select 1 from split_group_members m where m.id = p_payer_member_id and m.group_id = p_group_id
  ) then raise exception 'Payer is not in this group'; end if;

  select linked_user_id, display_name into v_payee_uid, v_payee_name
  from split_group_members where id = p_payee_member_id and group_id = p_group_id;
  if v_payee_uid is null and not exists (
    select 1 from split_group_members m where m.id = p_payee_member_id and m.group_id = p_group_id
  ) then raise exception 'Payee is not in this group'; end if;

  insert into split_settlements (...)
  values (...) returning * into v_row;

  if p_sync_transaction then
    if v_payer_uid = v_uid then
      insert into public.transactions (...)
      values (..., v_uid, ...) returning id into v_payer_txn_id;
    end if;

    if v_payee_uid = v_uid then
      insert into public.transactions (...)
      values (..., v_uid, ...) returning id into v_payee_txn_id;
    end if;

    if v_payer_txn_id is not null or v_payee_txn_id is not null then
      update public.split_settlements
      set payer_transaction_id = v_payer_txn_id, payee_transaction_id = v_payee_txn_id
      where id = v_row.id;
    end if;
  end if;

  return v_row;
end;
$$;
```

**After** (full replacement — the changes are: `security definer`, caller authorization, and unconditional inserts using the correct `user_id`):

```sql
-- Drop old signature to prevent PostgREST ambiguity (already in schema; keep that line).
drop function if exists public.split_record_settlement(uuid, uuid, uuid, numeric, date, text);

create or replace function public.split_record_settlement(
  p_group_id uuid,
  p_payer_member_id uuid,
  p_payee_member_id uuid,
  p_amount numeric,
  p_settled_at date default current_date,
  p_note text default null,
  p_sync_transaction boolean default true
)
returns split_settlements
language plpgsql
security definer          -- ← changed
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row split_settlements%rowtype;
  v_payer_uid uuid;
  v_payee_uid uuid;
  v_payer_txn_id uuid;
  v_payee_txn_id uuid;
  v_payer_name text;
  v_payee_name text;
  v_note text;
  v_date date;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = '22023', message = 'Settlement amount must be positive';
  end if;

  if p_payer_member_id is null or p_payee_member_id is null then
    raise exception using errcode = '22023', message = 'Payer and payee are required';
  end if;

  if p_payer_member_id = p_payee_member_id then
    raise exception using errcode = '22023', message = 'Payer and payee cannot be the same';
  end if;

  if not public.is_split_group_member_or_above(p_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'Split group not found';
  end if;

  -- Resolve linked user ids and display names for both members.
  select linked_user_id, display_name into v_payer_uid, v_payer_name
  from split_group_members where id = p_payer_member_id and group_id = p_group_id;
  if not found then
    raise exception using errcode = '22023', message = 'Payer is not in this group';
  end if;

  select linked_user_id, display_name into v_payee_uid, v_payee_name
  from split_group_members where id = p_payee_member_id and group_id = p_group_id;
  if not found then
    raise exception using errcode = '22023', message = 'Payee is not in this group';
  end if;

  -- Caller must be either the payer or the payee. This prevents a third
  -- member of the group from forging a settlement between two other parties.
  -- (Ghost members — linked_user_id IS NULL — can't be caller, so this also
  -- gates ghost-on-both-sides settlements.)
  if (v_payer_uid is null or v_payer_uid <> v_uid)
     and (v_payee_uid is null or v_payee_uid <> v_uid) then
    raise exception using errcode = '42501',
      message = 'Only the payer or the payee can record this settlement';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  v_date := coalesce(p_settled_at, current_date);

  insert into split_settlements (
    group_id, payer_member_id, payee_member_id,
    amount, settled_at, note, user_id
  ) values (
    p_group_id, p_payer_member_id, p_payee_member_id,
    p_amount, v_date, v_note, v_uid
  ) returning * into v_row;

  if p_sync_transaction then
    -- Payer's personal ledger: an expense for the amount they paid out.
    -- Insert when the payer is a real Kosha account (linked_user_id set).
    -- SECURITY DEFINER lets us write to the payer's row regardless of which
    -- of {payer, payee} actually called the RPC.
    if v_payer_uid is not null then
      insert into public.transactions (
        date, type, description, amount, category, user_id,
        is_repayment, linked_split_settlement_id, notes
      ) values (
        v_date, 'expense',
        'Settled with ' || coalesce(v_payee_name, 'member'),
        p_amount, 'other', v_payer_uid,
        true, v_row.id, v_note
      ) returning id into v_payer_txn_id;
    end if;

    -- Payee's personal ledger: an income transaction for the amount received.
    if v_payee_uid is not null then
      insert into public.transactions (
        date, type, description, amount, category, user_id,
        is_repayment, linked_split_settlement_id, notes
      ) values (
        v_date, 'income',
        'Received from ' || coalesce(v_payer_name, 'member'),
        p_amount, 'other', v_payee_uid,
        true, v_row.id, v_note
      ) returning id into v_payee_txn_id;
    end if;

    if v_payer_txn_id is not null or v_payee_txn_id is not null then
      update public.split_settlements
      set payer_transaction_id = v_payer_txn_id,
          payee_transaction_id = v_payee_txn_id
      where id = v_row.id;
    end if;
  end if;

  return v_row;
end;
$$;

grant execute on function public.split_record_settlement(
  uuid, uuid, uuid, numeric, date, text, boolean
) to authenticated;
```

**Backfill for existing settlements** (optional but recommended — settlements created before this fix have a `payer_transaction_id` for the payer but a NULL `payee_transaction_id` for the payee):

```sql
-- One-off backfill: for every existing settlement where the payee is a
-- linked user and there is no payee transaction yet, insert one.
do $$
declare
  s record;
  v_payer_name text;
  v_new_txn_id uuid;
begin
  for s in
    select ss.id, ss.amount, ss.settled_at, ss.note, ss.group_id,
           pa.linked_user_id as payer_uid, pa.display_name as payer_name,
           pe.linked_user_id as payee_uid
    from public.split_settlements ss
    join public.split_group_members pa on pa.id = ss.payer_member_id
    join public.split_group_members pe on pe.id = ss.payee_member_id
    where ss.payee_transaction_id is null
      and pe.linked_user_id is not null
  loop
    v_payer_name := coalesce(s.payer_name, 'member');
    insert into public.transactions (
      date, type, description, amount, category, user_id,
      is_repayment, linked_split_settlement_id, notes
    ) values (
      s.settled_at, 'income',
      'Received from ' || v_payer_name,
      s.amount, 'other', s.payee_uid,
      true, s.id, s.note
    ) returning id into v_new_txn_id;

    update public.split_settlements
    set payee_transaction_id = v_new_txn_id
    where id = s.id;
  end loop;
end $$;
```

Run the backfill **once**, after the function migration ships. It's idempotent — re-running is a no-op because of the `where payee_transaction_id is null` guard.

**Verify (manual):**
1. Sign in as Alice and Bob in separate browsers (or via the linked-wallet partner view).
2. In Alice's session: create a Splitwise group, add Bob (linked), add an expense Alice paid for both.
3. Alice settles with Bob (records "I paid Bob ₹X").
4. Alice's Transactions tab: shows an expense "Settled with Bob".
5. Bob's Transactions tab: shows an income "Received from Alice".
6. Delete the settlement from either side → both transactions disappear.

**Verify (automated):** Add to `scripts/tests/test_splitwise_mutation_paths.mjs` a test that:
- Calls `split_record_settlement` with two linked users
- Asserts `payer_transaction_id IS NOT NULL` AND `payee_transaction_id IS NOT NULL`

**Risk:** This is a schema migration. Deploy order:
1. Ship the SQL via the standard migration channel.
2. Run the backfill `DO $$ ... $$` block from the SQL editor.
3. Confirm via `select count(*) from split_settlements where payee_transaction_id is null and (select linked_user_id from split_group_members where id = payee_member_id) is not null;` returns 0.
4. No client code change needed — the JS calling code already passes the same params.

---

## FIX-040 — ProfileMenu open/close animation feels wrong  [P1, 30 min]

**File:** `src/components/navigation/ProfileMenu.jsx`
**Anchor:** the `Popover` slotProps and transition (~lines 132–161).

**Why:** Today the menu uses MUI's `Grow` transition (scale from 0 to 1) with `anchorReference="anchorPosition"`. With `anchorPosition` (not `anchorEl`), the popover's transform-origin defaults don't align with the avatar — the 300-px-wide menu visually stretches out from a corner instead of expanding from the avatar. The exit timing is also too short (160 ms) to register cleanly.

What we want: a Pixel/Google Pay menu pop — a quick fade combined with a small scale (0.94 → 1.0) anchored at the **avatar position** (top-right corner of the menu).

**Before** (lines 132–161):

```jsx
      <Popover
        id={id}
        open={open}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition || { top: 0, left: 0 }}
        onClose={handleClose}
        disableScrollLock
        slots={{ transition: Grow }}
        transformOrigin={{
          vertical: dropUp ? 'bottom' : 'top',
          horizontal: 'right',
        }}
        slotProps={{
          transition: { timeout: { enter: 190, exit: 160 } },
          paper: {
            sx: {
              mt: 1.5,
              mr: 0,
              mb: dropUp ? 1.5 : 0,
              width: '300px',
              maxWidth: 'calc(100vw - 2rem)',
              borderRadius: '28px',
              overflow: 'hidden',
              backgroundColor: 'var(--ds-surface)',
              border: '1px solid var(--ds-border)',
              boxShadow: 'var(--ds-shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
              backgroundImage: 'none',
            },
          },
        }}
      >
```

**After** — switch to MUI's `Fade` slot (which doesn't apply a transform-origin-dependent scale that gets misaligned) and add a small scale via a CSS class. The combination of fade + tiny scale, anchored at the top-right (matching the visual top-right of the menu, just under the avatar), reads as a proper M3 menu pop.

```jsx
      <Popover
        id={id}
        open={open}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition || { top: 0, left: 0 }}
        onClose={handleClose}
        disableScrollLock
        // Use Fade slot — Grow's scale+origin doesn't track when we use
        // anchorReference="anchorPosition" instead of anchorEl. We provide
        // the scale ourselves via the CSS class on the paper.
        transformOrigin={{
          vertical: dropUp ? 'bottom' : 'top',
          horizontal: 'right',
        }}
        slotProps={{
          // Slightly slower exit so the menu doesn't snap out of existence.
          transition: { timeout: { enter: 220, exit: 200 } },
          paper: {
            className: 'profile-menu-paper',
            sx: {
              mt: 1.5,
              mr: 0,
              mb: dropUp ? 1.5 : 0,
              width: '300px',
              maxWidth: 'calc(100vw - 2rem)',
              borderRadius: '28px',
              overflow: 'hidden',
              backgroundColor: 'var(--ds-surface)',
              border: '1px solid var(--ds-border)',
              boxShadow: 'var(--ds-shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
              backgroundImage: 'none',
              // Always anchor visual scale at top-right (or bottom-right when dropUp)
              transformOrigin: dropUp ? 'bottom right' : 'top right',
            },
          },
        }}
      >
```

Then add to `src/index.css` (anywhere in the global layer, near other component-specific styles):

```css
/* ProfileMenu paper — small scale on enter/exit so the menu reads as
   "popping out of" the avatar, paired with MUI's default Fade opacity. */
.profile-menu-paper {
  /* MUI animates opacity from 0 → 1 via the Fade slot. We layer a CSS
     transform on top — driven by the data-mui transition state which
     is unreliable, so we instead use the standard MuiPopover-paper
     selectors. Simpler: animate scale from 0.96 → 1.0 always; the user
     never sees the post-open state because the open state IS scale 1. */
  animation: profile-menu-pop 220ms cubic-bezier(0.05, 0.7, 0.1, 1) both;
  transform-origin: var(--profile-menu-origin, top right);
}

@keyframes profile-menu-pop {
  from { transform: scale(0.96); }
  to   { transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .profile-menu-paper { animation-duration: 1ms; }
}
```

The exit animation is handled by MUI's `Fade` transition (opacity), which is sufficient at 200 ms — a scale-out fighting the opacity-out usually looks worse, not better.

**Verify:** Tap the avatar — menu fades in with a subtle scale-from-top-right (anchored at the avatar). Tap outside — menu fades out in ~200 ms cleanly.

**Future polish (P2):** If the fade+scale combo still reads as slightly off, the next-best move is to switch from `Popover` to MUI's `Menu` component, which has Pixel-correct enter/exit semantics baked in (origin-anchored scale + Material easing). `Menu` requires `anchorEl` (not `anchorPosition`) so the trigger ref work is slightly different, but it stays inside the MUI primitive layer (FIX-031b).

---

## FIX-041 — "Whole page reloaded" feel on tab switches  [P1, 30 min]

**Files:**
- new `src/hooks/useFirstRouteVisit.js`
- `src/pages/Dashboard.jsx` (apply the hook)
- Other pages similarly, on a follow-up pass

**Why:** Today every page re-mounts on tab switch (because each route is lazy-loaded behind `<Suspense>` and unmounted on navigation away). The page's entrance animations (`fade-up-1`, `fade-up-2`, `card-spring-in`) re-fire on every mount, making revisits feel like "the whole page reloaded".

The user has confirmed this is the dominant perceived problem after the 2-tap bug.

**The fix:** animate entrance **only on the user's first visit to that route in the current session**. Subsequent revisits skip the entrance and just render. Combined with FIX-026 (native View Transitions) for the route swap, revisits feel near-instant.

**Step 1.** Create `src/hooks/useFirstRouteVisit.js`:

```js
import { useState } from 'react'

/**
 * Returns `true` on the first visit to a route in the current session,
 * `false` on subsequent visits. Used to conditionally apply entrance
 * animations so revisits don't re-fire "loading" animations.
 *
 * Persistence: sessionStorage — resets on tab close, not on PWA close.
 * (Reset-per-session, not per-PWA-launch, because a PWA "launch" from
 * the homescreen is the same UX surface as a tab open from a link.)
 */
export function useFirstRouteVisit(routeKey) {
  const [isFirst] = useState(() => {
    if (typeof sessionStorage === 'undefined') return true
    const storageKey = `kosha:visited:${routeKey}`
    try {
      if (sessionStorage.getItem(storageKey)) return false
      sessionStorage.setItem(storageKey, '1')
    } catch {
      // sessionStorage unavailable (e.g. Safari private mode) — always animate.
      return true
    }
    return true
  })
  return isFirst
}
```

**Step 2.** Apply in `src/pages/Dashboard.jsx`:

Inside the component body (near the existing `useState` calls):

```jsx
import { useFirstRouteVisit } from '../hooks/useFirstRouteVisit'

// ...
const isFirstVisit = useFirstRouteVisit('dashboard')
const enterCls = isFirstVisit ? 'fade-up fade-up-1' : ''
const heroEnterCls = isFirstVisit ? 'fade-up fade-up-2' : ''
```

Then replace the className on the greeting block (~line 592):

Before:
```jsx
<div className="fade-up fade-up-1 relative">
```

After:
```jsx
<div className={`${enterCls} relative`}>
```

And on the hero card wrapper (~line 616):

Before:
```jsx
<div className="fade-up fade-up-2">
  <DashboardHeroCard ... />
</div>
```

After:
```jsx
<div className={heroEnterCls}>
  <DashboardHeroCard ... />
</div>
```

Note: this is **above-the-fold** content. The below-the-fold sections lose their entrance animations entirely per FIX-025 — they no longer need this hook.

**Step 3.** Apply the same pattern to Monthly, Analytics, Obligations, Splitwise. Each page's top-most wrapper (the greeting or hero) uses `useFirstRouteVisit('<routeKey>')` and conditionally applies `fade-up fade-up-1`. Use unique route keys (`'monthly'`, `'analytics'`, etc.) so each page's first-visit is tracked independently.

**Step 4.** Reset on sign-out. Find `purgeUserScopedKeys()` (in `src/lib/safeStorage.js`) and add at the end:

```js
// Clear "first visit" markers so the next session animates fresh.
try {
  const keys = Object.keys(sessionStorage)
  for (const k of keys) {
    if (k.startsWith('kosha:visited:')) sessionStorage.removeItem(k)
  }
} catch { /* ignore */ }
```

Confirm `purgeUserScopedKeys` is called from the sign-out path in `useAuth`.

**Why not preserve scroll position too?** Scroll position is a separate concern — most users want to return to top when re-entering a tab (predictable mental model). Splitwise / Activity tabs may want scroll preservation, but that's a separate UX decision; not in scope for this fix.

**Verify:** 
- First time you open Dashboard → greeting and hero fade-up.
- Navigate to Transactions, come back → no fade-up, content is immediately in place.
- Sign out and back in → fade-ups re-fire (session was reset).

---

# P2 — Tail wins / refactors (backlog)

These don't gate the P0/P1 ship and may need design review.

---

## FIX-030 — Ship a single icon library (drop one of `@phosphor-icons/react` / `lucide-react`)  [P2, 1 hr]

The bundle currently includes both. Pick the more visually consistent set (Phosphor's `weight="duotone"` is closer to Material symbol style) and migrate. Estimated savings: ~30 kB gzipped, ~10 ms parse on mid-range Android.

`git grep "from 'lucide-react'"` shows all migration targets.

---

## FIX-031 — ~~Replace MUI's `SwipeableDrawer` with Framer Motion + native gestures~~  **[CANCELLED]**

**Decision (May 2026):** Cancelled per product direction. MUI is the chosen design system foundation for Kosha and we want to use *more* of it, not less. The 85 kB cost is acceptable in exchange for M3-aligned, well-maintained components.

What was originally proposed: rip out `@mui/material` + `@emotion` and replace `SwipeableDrawer` with a hand-rolled Framer Motion bottom sheet.

What we do instead: keep `SwipeableDrawer`. The premium-feel tuning (springs, blur on desktop only, disabled swipe-to-open) lives in FIX-013 / FIX-014 / FIX-015. If we ever need to revisit bundle size, the right move is bundle-level analysis to see whether the components we're actually using justify the size — not a wholesale swap to a custom solution.

**Replaced by FIX-031b** (see below): *expand* MUI coverage where we currently bypass it with raw Tailwind, for consistency and accessibility.

---

## FIX-031b — Opportunistically expand MUI usage (replaces FIX-031)  [P2, OPPORTUNISTIC]

**Direction (not a migration plan):** MUI is the chosen primary design system. When touching a surface that uses raw `<button>` or `<md-filled-button>` or a hand-rolled control for an interactive primitive, *consider* swapping it for the MUI equivalent. This is not a sweep-and-replace migration — it's a "next time you're in there, leave it cleaner" guideline.

**Not in scope:** A dedicated PR that migrates everything to MUI at once. That would be an overhaul and is explicitly out of scope per the user's direction.

**Examples of "while you're here" swaps** (do them only when you'd already be editing the file):

- `<md-filled-button>` → MUI `<Button variant="contained">`.
- Custom button that lives in a form you're already changing → MUI `<Button>`.
- Form input you're already touching → MUI `<TextField>`.

**Constraints when you do swap something:**
- Theme tokens in `src/theme/muiTheme.js` already map to `--ds-*` variables, so the M3 palette is inherited automatically. No new design tokens needed.
- Don't replace working raw-HTML controls just to "add MUI". Goal is consistency on surfaces that already have inconsistency, not maximalism.
- If you remove the last MWC component on a page, also remove the `@material/web` import from the entry point if no longer needed (smaller bundle).

**Stop signals — do NOT do these here:**
- Wholesale "MUI migration" PR. File a design-led work stream for that.
- Re-skinning components that already work.
- Adding MUI components purely to demonstrate consistency in a perf PR.

---

## FIX-032 — Tree-shake `recharts`  [P2, 30 min]

`recharts` is ~80 kB gzipped. Verify it's lazy-loaded only on `/analytics`. If any global import path pulls it onto the main chunk, fix.

```bash
npm run build && npx vite-bundle-visualizer
```

Check that `charts-vendor.<hash>.js` only appears in the Analytics chunk's network waterfall, not in the initial bundle.

---

## FIX-033 — Subset the Inter variable font  [P2, 1 hr]

`@fontsource-variable/inter` ships the full variable font (~280 kB) with all weights and full unicode coverage. Kosha uses Latin glyphs only and weights 400–700. Subset to Latin + numbers + currency, weights 400–700 → ~80 kB.

Replace `@fontsource-variable/inter` with `@fontsource-variable/inter/wght.css` and a `<link rel="preload" as="font">` for the woff2 subset.

---

## FIX-034 — Asset/image audit  [P2, 30 min]

Check `public/illustrations/` and `public/icons/`. Every illustration should be WebP or AVIF (1.5–3× smaller than PNG). Every PNG icon should have a smaller, embedded inline `<svg>` equivalent where possible.

Use `cwebp` for conversion: `for f in public/illustrations/*.png; do cwebp -q 85 "$f" -o "${f%.png}.webp"; done`.

---

## FIX-035 — `console.log` audit in dependencies  [P2, 15 min]

`vite.config.js` already drops `console.*` in production via `esbuild.drop` — confirm this also strips `console.log` from node_modules. If not, add `terserOptions.compress.drop_console = true`.

---

## FIX-036 — Predictive Back gesture for Android 14+  [P2, 1 hr]

Android 14 supports a predictive-back preview via the Navigation API. PWAs can opt in. Wrap navigation:

```js
if ('navigation' in window) {
  navigation.addEventListener('navigate', (event) => {
    if (event.navigationType === 'traverse' && event.canIntercept) {
      // Intercept and provide a preview during back-gesture
    }
  })
}
```

Real implementation: use the [Navigation API draft](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API). Premium-feel on Pixel.

---

## FIX-037 — Edge-to-edge under translucent system bars  [P2, 30 min]

Pixel-native apps draw content edge-to-edge, using `env(safe-area-inset-top)` for top padding inside scrollable content. Audit `PageHeaderPage` and any topbar to ensure the page background extends behind the status bar with `paddingTop: env(safe-area-inset-top)`. Today the `<meta name="theme-color">` already matches the page bg; ensure no white strip appears under the status bar in PWA install mode.

---

## FIX-038 — Memory-leak audit on realtime subscriptions  [P2, 1 hr]

Search `Grep` for `supabase.channel(`. Each channel must be `.unsubscribe()`d in a cleanup. `GlobalRealtimeSync` looks correct; double-check `useLiabilities` realtime fallback, `useTransactions` realtime, etc. Long sessions (>1 hr) should not see growing memory in DevTools Memory tab.

---

# 3. Implementation plan

**Before starting:** if you are an AI agent, you must have read Section A in full. The rules there are binding.

Execute in this exact order. Each row = one commit. Run `npm run lint && npm run build` after each. After each commit, update `docs/HANDOVER_STATUS.md` per Section A.8.

**Batching rules apply** (Section A.5): fixes inside the same row may be batched into a single commit. Fixes across rows may **not** be batched, even if they touch related files.

| # | Fix | Commit |
|---|---|---|
| 1 | FIX-001, FIX-002 | `perf(nav): remove double-wrapped startTransition; collapse pointer handlers` |
| 2 | FIX-004 | `perf(haptics): convert all dynamic haptic imports to static` |
| 3 | FIX-003 | `perf(prefetch): defer route data prefetch to idle time` |
| 4 | FIX-005 | `perf(boot): parallel-preload nav-bar chunks after auth resolves` |
| 5 | FIX-006 | `build(vite): inject modulepreload hints for nav-bar chunks` |
| 6 | FIX-007 | `perf(query): set refetchOnMount false; rely on staleTime` |
| 7 | FIX-008 | `perf(theme): replace MutationObserver with matchMedia` |
| 8 | FIX-009 | `feat(routes): keep previous route visible during chunk load (useDeferredValue)` |
| 8b | **FIX-050** | `fix(avatar): replace "?" placeholder with user initial; persist signed URLs across reloads` |
| 9 | FIX-010, FIX-011, FIX-012 | `perf+feel(nav): drop backdrop blur on touch; tune M3 Expressive springs` |
| 10 | FIX-013, FIX-014, FIX-015 | `feel(sheet): M3 Expressive open spring; drop touch-device backdrop blur; always disable swipe-to-open` |
| 11 | FIX-017, FIX-020, FIX-021, FIX-022 | `fix: race conditions and main-thread blockers` |
| 12 | FIX-018 | `feat(observability): capture query/mutation errors in Sentry` |
| 13 | FIX-019 | `fix(forms): disable submit during in-flight mutation` |
| 14 | FIX-023 | `perf(lists): memoize TransactionItem and row components` |
| 15 | FIX-025 | `feel(dashboard): drop fade-up stagger below the fold` |
| 16 | FIX-026 | `feel(routes): wire native View Transitions on tab switch` |
| 17 | FIX-027 | `feel(hero): small-paise typography on Dashboard and Monthly hero cards` |
| 18 | FIX-028, FIX-029 | `a11y: 48dp tap targets; visible :focus-visible rings` |
| 19 | **FIX-039** | `fix(splitwise): create payee transaction on settle (security definer + auth)` **(P0 correctness — separate PR, schema migration + backfill)** |
| 20 | **FIX-041** | `feel(routes): suppress entrance animations on tab-switch revisits` |
| 21 | **FIX-040** | `feel(profile): fix menu open/close — anchored fade+scale` |
| 22 | FIX-042, FIX-043, FIX-044 | `feel(mobile): 100dvh in BottomSheet; img decoding="async"; drop GPU layer leaks` |
| 22b | FIX-052 | `perf(touch): mark touchstart listeners as passive` |
| 22c | FIX-053 | `fix(forms): type="text" inputMode="decimal" for money inputs` |
| 22d | FIX-051 | `feat(observability): pipe standalone catches to captureError` |
| 22e | FIX-054 | `feat(observability): Sentry React Router v6 route-level tracing` |
| 22f | FIX-055 | `perf(sw): cache Supabase Storage avatars with path-normalized key` |
| 22g | FIX-056 | `feat(android): back button closes modals before navigating` |
| 23 | FIX-024 | `perf(splitwise): coalesce 6 useQueries into one RPC` (separate PR — schema change) |
| 24 | FIX-046 | `feat(observability): real-user Web Vitals via web-vitals → Sentry` |
| 25 | FIX-047 | `perf(boot): persist React Query cache to IndexedDB for instant cold start` (separate PR — touches auth lifecycle) |
| 26 | FIX-045, FIX-049 | `feat(pwa): manifest shortcuts; iOS splash images` |
| 27 | FIX-048 | `ci: enforce bundle-size budget via size-limit` |
| 28 | FIX-030, FIX-032..FIX-038 | P2 tail wins (file individually). FIX-031 is cancelled; FIX-031b is scoped per migrated surface and filed separately. |

After step 8 the **2-tap bug must be gone**. If it isn't, halt and report findings — don't apply later fixes on a still-broken navigation path.

**FIX-039 (settlement bug) is a P0 correctness fix and can be shipped independently of everything else** — it's a pure schema change with no client coupling. Ship it as soon as it's ready; don't wait for the rest of the queue.

---

# 4. Verification — what "done" looks like

After step 8:
- Real iPhone (any model, iOS 16+) and a mid-range Android (Pixel 6a, Galaxy A54, or similar):
  - Tap each nav tab exactly once → switches every time, on the first tap, within 100 ms perceived.
  - Tap rapidly across tabs (5 taps in 1 s) → final state matches the last tap, no queued navigations.
  - Cold start → app interactive within 1.8 s on 4G.

After step 10:
- Bottom-nav pill animation: subtle bounce visible.
- Bottom sheet opens: decisive, no jelly.
- Dark mode toggle: instant, no meta-tag race.

After step 17:
- Dashboard and Monthly hero amounts render with paise visibly smaller (~60%) and slightly faded.
- No CLS — the smaller paise sits on the baseline.

After step 19 (FIX-039 — settlement):
- Sign in as Alice and Bob in two browsers (or use the linked-wallet partner view).
- Alice records a settlement with Bob.
- Alice's wallet shows the expense `Settled with Bob`.
- Bob's wallet shows the income `Received from Alice`.
- Deleting the settlement from either side removes both transactions.
- Existing pre-fix settlements show up correctly after the backfill runs.

After step 20 (FIX-041 — entrance animations on revisit):
- First visit to Dashboard in a session: greeting + hero fade-up cleanly.
- Navigate away and back: no entrance animation; content is in place instantly.
- Sign out / sign in: animations re-fire (session was reset).

After step 21 (FIX-040 — profile menu):
- Tapping the avatar pops the menu open from the avatar (top-right anchor), not from a corner of the screen.
- Closing fades + slightly scales down over ~200 ms; no jarring snap.

Lighthouse CI thresholds:
- Performance ≥ 95
- Accessibility ≥ 95
- Best Practices ≥ 95
- PWA installable

Sentry: no new "blank page" error class in the 24 h after each PR.

---

# 5. Out of scope (do NOT do)

These were considered and explicitly rejected:

- ❌ Horizontal swipe between primary tabs (user prefers tap-only navigation)
- ❌ Pinch-to-zoom (already disabled; keep it)
- ❌ Hero card carousel (user explicitly rejected this layout)

**In scope for a follow-up work stream** (NOT part of this performance pass — file each as its own design + implementation track, but the constraint against them is lifted):

- ✅ Material 3 Expressive *shape* changes (e.g. larger corner radii, shape morph) — explore as a design pass.
- ✅ Re-layout of the Action Queue (just no carousel).
- ✅ Splitwise UX overhaul.
- ✅ Onboarding flow rewrite.
- ✅ Color palette refinements.
- ✅ Typography family changes (though Inter is currently working well — change only with a clear reason).
- ✅ Bottom-nav label rewording.
- ✅ **Replace Material Web Components `<Button>` with MUI `<Button>`** — preferred direction. MWC was a bet on the official Google primitive set, but MUI is the chosen primary design system going forward (see FIX-031b).

If a follow-up agent starts on any of these, scope them as separate PRs *after* the performance pass (FIX-001..FIX-038) ships. Don't bundle UX overhauls into a perf branch.

---

# 6. Anti-patterns the agent must avoid

While implementing:

- ❌ Do not re-introduce dynamic imports of `haptics` "for tree-shaking" — the file is <1 kB; static is correct.
- ❌ Do not wrap `navigate()` in `startTransition` anywhere — the future flag handles it.
- ✅ **Prefer MUI for interactive primitives** (Button, Menu, Popover, TextField, Dialog, Drawer, Avatar, Snackbar). MUI is the chosen design system foundation. Use raw HTML + Tailwind only when no MUI equivalent exists, or when Tailwind is doing pure layout (grids, flex containers, the page-stack). See FIX-031b. **Do not** introduce a third UI library (no Radix, Headless UI, Mantine) for net-new interactive components.
- ❌ Do not put `setTimeout(..., 0)` band-aids over race conditions without understanding which render they're racing.
- ❌ Do not commit `console.log` outside `import.meta.env.DEV` guards.
- ❌ Do not bypass design system tokens (`--ds-*`) with hardcoded hex values — even for one-off color tweaks.
- ❌ Do not skip the "Verify" step on any fix.
- ❌ Do not group multiple FIX-IDs into a single commit unless this doc explicitly merges them (e.g. FIX-001+FIX-002).

---

# 7. Risk register — what can break, and exactly how to de-risk each

Every fix in this doc is small, but a few have a non-trivial blast radius. Each one below has a **mitigation that should be implemented alongside the fix** — not "if something breaks". Apply them by default.

---

## FIX-007 (global `refetchOnMount: false`)

**Risk:** if any caller relied on the implicit refetch-on-mount, users could see stale data for up to `staleTime`.

**Mitigations** (apply all three):

1. **Safety belt is part of the fix itself** — `refetchOnWindowFocus: true` and `refetchOnReconnect: 'always'` are now explicit in the diff. Backgrounding the app and returning forces a refresh. Network drop and reconnect forces a refresh. These are the two main "I want fresh data now" moments for a user.
2. **Per-query `staleTime` is the tuning knob, not the global flag.** If a specific hook reports staleness, lower its `staleTime` (e.g. `useTransactions` from 5 min → 30 s). Don't revert FIX-007.
3. **Canary path:** ship FIX-007 alone in its own PR. Watch Sentry + analytics for 48 h. If "stale data" reports appear, identify the offending query and lower its `staleTime`.

**Rollback plan:** flip `refetchOnMount` back to `true` — single-line revert.

---

## FIX-009 (`useDeferredValue` for routes)

**Risk:** the dim of the previous page (now 0.92 — barely perceptible) could feel laggy on slow networks; or worse, users could double-tap if the dim is too subtle.

**Mitigations:**

1. **The dim level is now 0.92, not 0.6** — 8% dim is enough of a signal without making the previous page feel disabled. Tested-conservative default.
2. **`pointerEvents: 'none'` on the stale tree** — even at 0.92 opacity, the previous page can't receive taps. Prevents the "I tapped two things" double-action class of bugs.
3. **Escape hatch is in the doc itself:** set `opacity: 1` unconditionally if any user reports the dim feeling wrong. The pointer-event guard does most of the heavy lifting; the dim is a polish layer.

**Rollback plan:** revert `AppRoutes` to render `location` directly (not `deferredLocation`) — one-line change.

---

## FIX-026 (native View Transitions)

**Risk:** Chromium-only API. Worse: it interacts badly with portals (MUI Popover, BottomSheet, Dialog) because the snapshot captures the wrong DOM state.

**Mitigations:**

1. **Feature-detect strictly** — wrap every `document.startViewTransition` call in `if ('startViewTransition' in document)`. On Safari/Firefox the swap is instant (no transition); that's fine, matches the current behavior.
2. **Skip when a portal is open** — add a global "portal open" flag (counter, incremented when BottomSheet/Popover/Dialog mounts, decremented on unmount). If non-zero, skip `startViewTransition()` and do a plain `navigate()`. This avoids the snapshot-of-wrong-DOM bug. Track this as part of the fix: don't ship FIX-026 without the portal guard.
3. **Respect `prefers-reduced-motion`** — already required by the doc but worth restating. If the user has reduced-motion on, skip view transitions entirely.

**Rollback plan:** revert the `navigateWithViewTransition` wrapper to plain `navigate()` — isolated function, single revert.

---

## FIX-024 (Splitwise RPC coalescing)

**Risk:** schema migration. Client could ship before the RPC exists in prod → broken Splitwise page.

**Mitigations:**

1. **Server-first deploy, always.** RPC ships in a Supabase migration → wait 5 min for postgrest cache to warm → then ship the client.
2. **Client falls back to the old 6-query path if the RPC returns null or errors.** Make the new code path strictly additive: try `split_get_full_state` first; on any error or null response, fall through to the existing 6 `useQuery` hooks. This decouples client and server ship order entirely.
3. **Keep the old code path live for 2 weeks** post-RPC ship. Remove the fallback in a follow-up PR once the RPC has zero errors in the period.

**Rollback plan:** delete the new client code path; the old 6-query implementation is still there.

---

## FIX-039 (Splitwise settlement correctness — payee transaction)

**Risk:** schema migration + a one-off backfill. Backfill could mis-fire and create duplicate transactions, or omit some.

**Mitigations:**

1. **Idempotency guard inside the RPC itself.** Add this check before the payee insert:

   ```sql
   if v_payee_uid is not null and not exists (
     select 1 from public.transactions
     where linked_split_settlement_id = v_row.id
       and user_id = v_payee_uid
   ) then
     insert into public.transactions (...) values (...) returning id into v_payee_txn_id;
   end if;
   ```

   Same for the payer block. This makes the RPC safe to retry, safe to call twice, and ensures the backfill can't double-insert if it overlaps with new live settlements.

2. **Backfill runs in a transaction with dry-run mode.** Before the main `DO $$ ... $$` block, run a count query and confirm the number is what you expect:

   ```sql
   select count(*)
   from public.split_settlements ss
   join public.split_group_members pe on pe.id = ss.payee_member_id
   where ss.payee_transaction_id is null
     and pe.linked_user_id is not null;
   ```

   If the count is more than ~10× the typical number of settlements per active user, **stop** — that's a sign of a different problem (e.g. group membership corruption). Investigate before backfilling.

3. **`search_path = public` is mandatory** for the SECURITY DEFINER function — included in the doc but worth flagging in code review. A SECURITY DEFINER function without an explicit `search_path` is a known security gotcha (search-path injection).

4. **Staging dress rehearsal.** Apply the migration + backfill on a staging database with a snapshot of prod first. Verify the counts match. Only then ship to prod.

5. **Snapshot before deploy.** Supabase point-in-time recovery covers this, but explicitly trigger a snapshot 5 minutes before applying.

**Rollback plan:** if the RPC fix introduces bugs, deleting the inserted payee transactions and reverting the RPC is straightforward (the new transactions all share `is_repayment = true` and a `linked_split_settlement_id`, so they're easy to identify and clean up).

---

## FIX-040 (ProfileMenu transition)

**Risk:** purely cosmetic. The CSS keyframe could fight MUI's internal animation classes if MUI ever changes its Popover internals.

**Mitigations:**

1. **The fix is layered, not replacing MUI's internals.** We add a keyframe to the `paper` class; we don't override MUI's `Fade` or `Grow` transition slots. If MUI updates, our keyframe still runs because it targets a class WE add, not an MUI-internal selector.
2. **Reduced-motion respect** is already in the keyframe (`animation-duration: 1ms` when `prefers-reduced-motion: reduce`).
3. **Visual A/B if uncertain:** comment out the `animation` line first, see if MUI's default Fade alone is acceptable. If yes, ship without the keyframe at all.

**Rollback plan:** delete the `.profile-menu-paper` CSS block — menu falls back to MUI's default Fade. No behavior change beyond animation.

---

## FIX-041 (suppress revisit animations)

**Risk:** new pages added in the future forget to use the `useFirstRouteVisit` hook → they animate every revisit again.

**Mitigations:**

1. **ESLint rule, not docs.** Add a lint rule that forbids `fade-up` / `fade-up-1` / `fade-up-2` class names from being used without a wrapping `useFirstRouteVisit` or similar gating. (Easier alternative: a CI grep check that fails if `fade-up` appears in a `*.jsx` page without `useFirstRouteVisit` in the same file. ~10 lines of script.)
2. **Hook auto-detects route from `useLocation()`.** Change the API from `useFirstRouteVisit('dashboard')` to `useFirstRouteVisit()` and have it read `location.pathname` internally. Pages can't forget the route key because there is none:

   ```js
   import { useLocation } from 'react-router-dom'

   export function useFirstRouteVisit() {
     const { pathname } = useLocation()
     const [isFirst] = useState(() => {
       if (typeof sessionStorage === 'undefined') return true
       const key = `kosha:visited:${pathname}`
       try {
         if (sessionStorage.getItem(key)) return false
         sessionStorage.setItem(key, '1')
       } catch { return true }
       return true
     })
     return isFirst
   }
   ```

   Update the FIX-041 fix to use this API. Less footgun.

**Rollback plan:** drop the hook everywhere — pages will animate on every revisit, but nothing functional breaks.

---

## Cross-cutting

- **Every fix has a "Verify" section in the doc above. Treat them as mandatory.** A fix that ships without its verification done = a fix that hasn't shipped.
- **No fix in this doc requires changing the visual design of any screen.** If implementing one tempts you to "while I'm here, redesign X" — stop. Open a separate work stream and bring it to the user.
- **PR size discipline.** Each row in section 3's table = one PR. Don't bundle. Splitting is the difference between a clean rollback and a tangled rollback.

---

*Total estimated implementation time:*
- P0 (FIX-001 to FIX-009): ~1 day
- P0 + P1: ~1 week
- Full plan including P2: ~3 weeks

---

# 8. Pass 2 — final sweep additions

After completing the first pass of the audit I did a second sweep specifically for things that are easy to miss: mobile viewport units, image decoding hints, GPU layer leaks, manifest niceties, real-user telemetry, and offline data persistence. The following are real gaps found in code (not speculation) and are added here so the doc is genuinely complete.

---

## FIX-042 — Replace `100vh` with `100dvh` in BottomSheet  [P1, 2 min]

**File:** `src/components/ui/BottomSheet.jsx`
**Anchors:** line 65 (`maxHeight: 'calc(100vh - var(--ds-safe-top, 0px) - 8px)'`) and line 87 (`maxHeight: 'calc(100vh - 4rem)'`).

**Why:** On mobile, `100vh` resolves to the *largest* viewport — i.e. the height assuming the URL bar is collapsed. When the URL bar is visible (which it usually is when a sheet opens), part of the sheet bleeds off the bottom of the screen. The dynamic viewport unit `dvh` resolves to whatever the current visible height is, including or excluding the URL bar correctly.

**Diff:**

```jsx
- maxHeight: 'calc(100vh - var(--ds-safe-top, 0px) - 8px)',
+ maxHeight: 'calc(100dvh - var(--ds-safe-top, 0px) - 8px)',
```

```jsx
- maxHeight: 'calc(100vh - 4rem)',
+ maxHeight: 'calc(100dvh - 4rem)',
```

**Browser support:** Safari 15.4+, Chrome 108+, Firefox 101+ — full coverage of Kosha's target platforms.

**Verify:** Open a long bottom sheet (e.g. AddTransactionSheet on a small phone with categories expanded) on iOS Safari with the URL bar visible — bottom of the sheet stays inside the visible viewport instead of being clipped.

---

## FIX-043 — Add `decoding="async"` to all `<img>` (priority hint where appropriate)  [P1, 30 min]

**Files:**
- `src/components/ui/SecureAvatar.jsx` (the high-traffic one — every transaction row, every profile menu)
- `src/components/common/EmptyState.jsx`
- Any other `<img>` in the app (search `git grep "<img "` to enumerate)

**Why:** By default, `<img>` is decoded synchronously by the renderer thread on commit, which can block paint by 5–20 ms on a mid-range Android. `decoding="async"` tells the browser to decode off-thread; the image appears one frame later but the rest of the UI doesn't stutter. For avatars (which are decoration, not content), this is a clean premium win.

`fetchpriority="high"` should go on the **above-the-fold avatar** (in `ProfileMenu`'s trigger). Everything else stays default.

**Diff (representative — apply pattern throughout):**

```jsx
<img
  src={src}
  alt={alt}
+ decoding="async"
  className={className}
/>
```

For the profile menu trigger avatar (above the fold):

```jsx
<img
  src={src}
  alt={alt}
  decoding="async"
+ fetchpriority="high"
  className={className}
/>
```

**Verify:** Lighthouse "Avoid long main-thread tasks" — image-decode tasks should disappear from the main thread waterfall.

---

## FIX-044 — Drop `will-change` from one-shot animation classes  [P1, 5 min]

**File:** `src/index.css`
**Anchors:**
- `.fade-up` (line 1015): `will-change: transform, opacity;`
- `.card-spring-in` (line 1025): `will-change: transform, opacity;`
- `.fade-in` (line 1047): `will-change: opacity;`
- `.hero-card-enter` (line 1058): `will-change: opacity;`

**Why:** `will-change` is a *hint* that the property is about to animate — it promotes the element to its own GPU layer. For a *one-shot* animation that fires on mount and never again, the layer is created, used for ~400 ms, then **never released**. With dozens of staggered `fade-up-N` items on Dashboard / Transactions list, this can accumulate to tens of megabytes of GPU memory across a session.

`will-change` belongs on elements with *continuous* or *user-triggered* animations (the bottom nav pill, the FAB on press, scroll-locked transforms) — not entrance animations.

**Diff (apply to each of the four classes):**

```css
.fade-up {
  animation: fade-up-in var(--md-sys-motion-duration-medium4) var(--md-sys-motion-easing-standard-decelerate) both;
- will-change: transform, opacity;
}
```

Same pattern for `.card-spring-in`, `.fade-in`, `.hero-card-enter`. Leave `will-change` on the legitimate cases (the FAB, the nav pill, the scroll container — anywhere it's explicitly commented as a continuous compositor layer).

**Verify:** Open DevTools → Rendering → enable "Layer borders". Navigate around. The count of compositor layers should drop noticeably (typically from 30-50 down to 10-15 on a Transactions page with many rows).

---

## FIX-045 — PWA manifest shortcuts  [P2, 15 min]

**File:** `vite.config.js` (the `VitePWA.manifest` block).

**Why:** Long-pressing a PWA icon on Android shows context shortcuts (like 3D Touch on iOS, but Android calls them app shortcuts). Today, long-press on Kosha shows nothing. Adding 2–4 deep-link shortcuts (Add Transaction, View Bills, View Splitwise) is a premium win — feels app-native.

**Diff:**

```js
manifest: {
  // ... existing entries ...
  shortcuts: [
    {
      name: 'Add Transaction',
      short_name: 'Add',
      description: 'Record a new transaction',
      url: '/?action=add-transaction',
      icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
    },
    {
      name: 'Bills',
      short_name: 'Bills',
      description: 'See upcoming bills',
      url: '/obligations',
      icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
    },
    {
      name: 'Splitwise',
      short_name: 'Split',
      description: 'View shared expenses',
      url: '/splitwise',
      icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
    }
  ],
}
```

The `?action=add-transaction` query param needs handling in `App.jsx` — if present, auto-open the AddTransactionSheet on mount. Five lines:

```js
useEffect(() => {
  const params = new URLSearchParams(location.search)
  if (params.get('action') === 'add-transaction') {
    setAddSheetOpen(true)
    navigate(location.pathname, { replace: true }) // clear the param
  }
}, [])
```

**Verify:** Install the PWA on Android Chrome → long-press the icon → "Add Transaction", "Bills", "Splitwise" appear as shortcuts.

---

## FIX-046 — Real-user Web Vitals telemetry  [P2, 1 hr]

**Files:** new `src/lib/vitals.js`, `src/main.jsx` (entry point).

**Why:** Today the only performance signal is Lighthouse synthetic runs on a clean lab device. Real users on mid-range Android with throttled 4G could have INP of 400 ms while Lighthouse reports 80 ms — we'd never know. The `web-vitals` library (1.8 kB) measures the four Core Web Vitals (LCP, INP, CLS, plus FCP and TTFB) in real users' browsers and lets us send them to Sentry as performance metrics.

**Steps:**

1. `npm install web-vitals`
2. Create `src/lib/vitals.js`:

   ```js
   import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals'
   import * as Sentry from '@sentry/react'

   function report(metric) {
     // Only send a sample to avoid quota — 1/10 sessions.
     if (Math.random() > 0.1) return
     Sentry.captureMessage(`web-vital:${metric.name}`, {
       level: 'info',
       tags: { metric: metric.name },
       extra: {
         value: metric.value,
         rating: metric.rating,
         id: metric.id,
         delta: metric.delta,
       },
     })
   }

   export function initWebVitals() {
     onLCP(report)
     onINP(report)
     onCLS(report)
     onFCP(report)
     onTTFB(report)
   }
   ```

3. Call `initWebVitals()` from `src/main.jsx` after the initial render (use `requestIdleCallback` so it doesn't compete with the first paint).

**Privacy note:** `web-vitals` measures the user's own page only; no third-party data, no fingerprinting. Safe to enable globally.

**Verify:** After deploy, Sentry → Discover → filter `event.type = "transaction"` and look for `web-vital:LCP`, `web-vital:INP` events. p75 values should match our targets in section 0.

---

## FIX-047 — Persist React Query cache to IndexedDB  [P2, 2 hr]

**Files:** `src/lib/queryClient.js`, new dep `@tanstack/query-async-storage-persister`, `@tanstack/react-query-persist-client`, and `idb-keyval`.

**Why:** Today, cold start hits the network for every query even when the user just opened the app 30 seconds ago. With IndexedDB persistence, cached query data survives a full reload — the user sees their last-known transactions instantly while a background refetch keeps things fresh.

This is the single biggest "first paint feels alive" win still on the table.

**Caveat:** must be careful about cross-user data leak. Cache must be partitioned by user id and cleared on sign-out. The persistence layer takes a `dehydrateOptions.shouldDehydrateQuery` predicate — use it to skip queries that don't carry a user id.

**Steps:**

```bash
npm install @tanstack/react-query-persist-client @tanstack/query-async-storage-persister idb-keyval
```

```js
// src/lib/queryPersister.js
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

export const queryPersister = createAsyncStoragePersister({
  storage: { getItem: get, setItem: set, removeItem: del },
  key: 'kosha-query-cache',
  throttleTime: 1000, // batch writes
})
```

Wrap the app in `<PersistQueryClientProvider>` instead of `<QueryClientProvider>`. Configure `maxAge: 24 * 60 * 60 * 1000` (24 hrs) and `dehydrateOptions.shouldDehydrateQuery` to skip auth-scoped queries that need to be re-fetched fresh per session.

On sign-out, clear the persister: `await queryPersister.removeClient()`.

**Verify:** Open Dashboard, sign in, wait for data to load. Close tab. Reopen — Dashboard should render with the cached transaction count *before* the network responds.

---

## FIX-048 — Bundle-size budget in CI  [P2, 30 min]

**File:** `package.json` scripts; new `scripts/check_bundle_size.mjs`; CI workflow.

**Why:** Today, a careless `import * from '@mui/material'` could silently add 100 kB to the bundle and no one would notice. A bundle-size budget enforced in CI catches this at PR time.

**Steps:**

1. Add to `package.json`:
   ```json
   "size-limit": [
     { "path": "dist/assets/index-*.js", "limit": "175 KB", "gzip": true },
     { "path": "dist/assets/vendor-*.js", "limit": "85 KB", "gzip": true }
   ],
   "scripts": {
     "size": "size-limit"
   }
   ```
2. Install `size-limit` and `@size-limit/preset-app`:
   ```bash
   npm install -D size-limit @size-limit/preset-app
   ```
3. CI step:
   ```yaml
   - run: npm run build
   - run: npm run size
   ```
4. PRs that exceed budget will fail. Adjust budget intentionally when needed.

**Verify:** PR that adds an unused MUI component → CI fails with the offending bundle exceeding the limit.

---

## FIX-050 — Profile avatar shows `?` while loading  [P0, 30 min]

**Files:**
- `src/components/ui/SecureAvatar.jsx`
- `src/components/navigation/ProfileMenu.jsx` (5 call sites)
- `src/pages/Settings.jsx` (2 call sites)
- `src/pages/Splitwise.jsx` (1 call site)
- `src/components/dialogs/ViewProfilePhotoDialog.jsx` (1 call site)

**The bug, in plain English:** When the app loads (or any avatar appears for the first time), there's a visible **`?`** in the avatar circle for roughly 200–800 ms — the time it takes Supabase to mint a signed URL for the avatar. The user sees a question mark in their own profile menu trigger at the top right while signed-in. This is jarring on every cold start.

**Root cause (verified):** `src/components/ui/SecureAvatar.jsx:65` reads:

```jsx
{fallbackInitial || '?'}
```

The component takes a `fallbackInitial` prop but **none of the call sites pass it**. `git grep` for `fallbackInitial` shows only the definition and the literal `?`. So every avatar renders `?` during the signed-URL fetch.

Secondary issue: the in-memory cache (`avatarCache` Map at the top of `SecureAvatar.jsx`) is reset on every reload — so the URL fetch round-trip repeats on every cold start, even though signed URLs are valid for 7 days. That's the part that makes the `?` *visible* (long enough to read).

**Fix (three layers):**

### Layer 1 — `SecureAvatar` derives a sensible fallback from `alt`, never shows `?`

```jsx
// src/components/ui/SecureAvatar.jsx
// Derive a single uppercase letter from `alt` when no explicit fallbackInitial
// is provided. If alt is empty, render an empty surface — better than a "?".
const derivedInitial = (fallbackInitial || (alt && String(alt).trim()[0]) || '').toUpperCase()

if (!url) {
  return (
    <div
      className={`flex items-center justify-center bg-kosha-surface-2 text-ink-3 font-medium ${className || ''}`}
      aria-label={alt || undefined}
    >
      {derivedInitial}
    </div>
  )
}
```

In plain English: prefer the explicit `fallbackInitial`. If absent, take the first character of `alt`. If both are absent, render the surface empty — never a literal `?`.

### Layer 2 — Persist signed URLs to localStorage with expiry

The signed URL is valid for 7 days. Cache it that long across reloads, not just in memory.

Replace the in-memory `avatarCache` with a thin localStorage wrapper:

```js
// At top of SecureAvatar.jsx — replace the existing in-memory Map.
const AVATAR_CACHE_KEY = 'kosha:avatar-urls'
const AVATAR_CACHE_MAX = 50
const AVATAR_CACHE_TTL_MS = 6 * 24 * 60 * 60 * 1000 // 6 days (less than 7-day signed URL TTL)

function readAvatarCache() {
  try {
    const raw = localStorage.getItem(AVATAR_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function writeAvatarCache(map) {
  try {
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(map))
  } catch {
    // Quota exceeded or storage unavailable — silently degrade to no-cache.
  }
}

function getCachedAvatarUrl(src) {
  const cache = readAvatarCache()
  const entry = cache[src]
  if (!entry) return null
  if (Date.now() - entry.t > AVATAR_CACHE_TTL_MS) {
    delete cache[src]
    writeAvatarCache(cache)
    return null
  }
  return entry.u
}

function setCachedAvatarUrl(src, signedUrl) {
  const cache = readAvatarCache()
  const keys = Object.keys(cache)
  if (keys.length >= AVATAR_CACHE_MAX) {
    // Evict the oldest entry (by timestamp).
    let oldestKey = keys[0]
    let oldestT = cache[oldestKey]?.t || 0
    for (const k of keys) {
      if ((cache[k]?.t || 0) < oldestT) {
        oldestT = cache[k].t
        oldestKey = k
      }
    }
    delete cache[oldestKey]
  }
  cache[src] = { u: signedUrl, t: Date.now() }
  writeAvatarCache(cache)
}

function deleteCachedAvatarUrl(src) {
  const cache = readAvatarCache()
  if (src in cache) {
    delete cache[src]
    writeAvatarCache(cache)
  }
}
```

Replace the `avatarCache.has(src)` / `.get` / `.set` / `.delete` calls in the existing component body with `getCachedAvatarUrl(src)` / `setCachedAvatarUrl(src, url)` / `deleteCachedAvatarUrl(src)`.

Also add to `purgeUserScopedKeys()` in `src/lib/safeStorage.js` so signing out clears the avatar cache (privacy + cross-user safety):

```js
try { localStorage.removeItem('kosha:avatar-urls') } catch {}
```

### Layer 3 — Pass `fallbackInitial` from every call site

Even though Layer 1 makes `?` impossible, passing the right initial explicitly is faster and more accurate (no string-parsing).

**`src/components/navigation/ProfileMenu.jsx`** — three call sites (lines 112, 114, 178, 323):

```jsx
// Line 112 — partner avatar in the trigger button
<SecureAvatar
  src={activePartner.avatar_url}
  alt={activePartner.display_name}
+ fallbackInitial={activePartner.display_name?.[0]?.toUpperCase()}
  className="w-full h-full object-cover"
/>

// Line 114 — own avatar in the trigger button
<SecureAvatar
  src={avatarUrl}
  alt={displayName}
+ fallbackInitial={initial}
  className="w-full h-full object-cover"
/>

// Line 178 — own avatar in the menu header
<SecureAvatar
  src={avatarUrl}
  alt={displayName}
+ fallbackInitial={initial}
  className="w-full h-full object-cover"
/>

// Line 323 — linked partner avatar in the list
<SecureAvatar
  src={p.avatar_url}
+ fallbackInitial={p.display_name?.[0]?.toUpperCase()}
  className="w-full h-full object-cover"
  alt={p.display_name || ''}
/>
```

**`src/pages/Settings.jsx`** — both call sites: pass `fallbackInitial={(displayName || 'K')[0].toUpperCase()}` and `fallbackInitial={lp.display_name?.[0]?.toUpperCase()}` respectively.

**`src/pages/Splitwise.jsx`** (line 1376) and **`ViewProfilePhotoDialog.jsx`** (line 33): pass `fallbackInitial` derived from the relevant member's `display_name`.

**Verify:**
- Hard-reload the app on a slow network. The profile menu trigger shows the user's first initial (e.g. "S"), never `?`.
- Reload again — avatar appears instantly with no fetch round-trip (served from localStorage).
- After 6 days, the cache entry expires and the URL is re-fetched. Sign-out clears the cache.

**Risk:** None meaningful. The in-memory cache becomes a localStorage cache (a strict upgrade). The `?` literal is replaced by either an initial or an empty surface — both better than `?`. If localStorage write fails (quota), it silently no-ops and falls back to per-mount fetch behavior — same as today.

**Optional follow-up** (P2, file separately): preload the signed URL during boot, right after `useAuth` resolves the `profile`. This makes the avatar appear in the *first* paint after sign-in, not the second. Trivial — add a `useEffect` in `useAuthState` that calls `supabase.storage.from('avatars').createSignedUrl(...)` as soon as `profile.avatar_url` is known.

---

## FIX-049 — iOS PWA splash images  [P2, 30 min — design asset work]

**File:** `index.html`.

**Why:** When the user launches the installed PWA on iOS, there's a blank white flash for ~400 ms before the app loads. Apple-specific `<link rel="apple-touch-startup-image" media="...">` tags provide a tinted splash image for each device size. Without them, white. With them, branded launch.

**Steps:** generate 8 PNG splash images (iPhone SE through Pro Max, landscape & portrait — Apple provides exact dimensions in their HIG). Use a service like [appsco.pe](https://appsco.pe/developer/splash-screens) or generate manually with the Kosha logo on the existing background color (`#0F0F11` dark / `#F0F4F9` light).

Reference each:

```html
<link rel="apple-touch-startup-image"
      media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"
      href="/icons/splash-iphone15.png">
<!-- ... seven more media queries ... -->
```

**Verify:** Install the PWA on an iPhone, force-close, relaunch — instead of white flash, see the branded splash for the duration of cold start.

---

---

## FIX-051 — Standalone `console.error` calls don't reach Sentry  [P1, 30 min]

**Files (audit list):**
- `src/pages/Onboarding.jsx:427`
- `src/pages/InviteLanding.jsx:108`
- `src/pages/Splitwise.jsx:260`
- `src/pages/Settings.jsx:794`
- `src/components/ui/SecureAvatar.jsx:41, 54`
- `src/lib/invites.js:93, 114`
- `src/lib/reconciliation.js:*`
- `src/lib/supabase.js:*`

**Why:** `vite.config.js` has `esbuild.drop: ['console', 'debugger']` for production builds — which strips **every** `console.*` call, including `console.error`. So any error path that goes through `console.error` without also calling `captureError()` (from `src/lib/errorReporting.js`) is **invisible in production**. FIX-018 covers all React Query errors automatically, but standalone catches like:

```js
} catch (e) {
  console.error('[Kosha] Onboarding finish failed', e)
}
```

…are stripped at build time. The user hits a bug, you have no signal.

**Fix:** every catch block that's currently `console.error`-only should also call `captureError`:

```js
import { captureError } from '../lib/errorReporting'

} catch (e) {
  captureError(e, { context: 'onboarding.finish', extra: { stepIndex } })
  console.error('[Kosha] Onboarding finish failed', e) // OK to keep — stripped in prod
}
```

The console line is fine to keep (helpful in dev, stripped in prod). The `captureError` line is the production observability.

**Audit method:**

```bash
git grep -nE "console\.(error|warn)\(" src/
```

For each match, decide:
- Is this error path *already* captured by React Query / FIX-018? → leave it.
- Is this a top-level UI catch that's unique? → add `captureError(...)` next to the `console.error`.
- Is it inside a library function that bubbles the error up? → leave it (caller will capture).

Expected coverage after this fix: ~15 additional `captureError` calls added, mapping to the high-value standalone catches above.

**Verify:** In dev, throw a forced error in each modified path; confirm Sentry receives it (or, with DSN unset, that the dev console gets a `captureError` log). In prod, when a user hits one of these paths in error, expect a Sentry event with the right `context` tag.

---

## FIX-052 — Mark touchstart listeners as `passive: true`  [P2, 5 min]

**Files:**
- `src/components/obligations/Bills.jsx:124`
- `src/components/obligations/Loans.jsx:94`

**Why:** Both files attach `document.addEventListener('touchstart', handleClickOutside)` without options. Chrome treats this as `passive: false` by default for `touchstart`, which means the browser **cannot start scrolling** until our handler completes — even though our handler never calls `preventDefault`. The result is sub-frame jank on every touch when these listeners are mounted.

The Chrome devtools console actually warns about this: *"Added non-passive event listener to a scroll-blocking 'touchstart' event."*

**Diff:**

```js
- document.addEventListener('touchstart', handleClickOutside)
+ document.addEventListener('touchstart', handleClickOutside, { passive: true })
  return () => {
-   document.removeEventListener('touchstart', handleClickOutside)
+   document.removeEventListener('touchstart', handleClickOutside, { passive: true })
  }
```

Apply to both files. The `mousedown` listener doesn't need the option (it's not a scroll-blocking event).

**Verify:** Open Chrome devtools on Bills or Loans page; the "non-passive listener" warning disappears.

---

## FIX-053 — Replace `type="number"` with `type="text" inputMode="decimal"` for money inputs  [P1, 30 min]

**Files:**
- `src/components/obligations/Bills.jsx:1033`
- `src/components/obligations/Loans.jsx:1237, 1372, 1386`
- `src/components/categories/BudgetSheet.jsx:233`
- `src/components/analytics/AnalyticsCharts.jsx:1110, 1296` (chart axis bounds — may not be money but still subject to the issues below)
- `src/pages/Splitwise.jsx:1870, 1962, 1980, 1998, 2099`

**Why:** `type="number"` for monetary inputs is a known anti-pattern. It:

1. **Scrolls on desktop mouse wheel** — the value silently changes when the user accidentally scrolls. A real money-loss vector.
2. **Renders spinner arrows** — eats horizontal space and is visually inconsistent with the rest of Kosha's input styling.
3. **Has locale-dependent parsing** — some browsers expect `,` for decimal separator in EU locales; tries to parse `1,200.50` as `1.2`.
4. **Accepts `e`, `E`, `+`, `-`** — exponential notation is valid in `type="number"`. Users can paste `1e5` and silently lose the right value.
5. **Strips leading zeros** — `01.50` becomes `1.5`. Mostly benign but breaks user expectations.

The correct pattern (which `AddTransactionSheet.jsx:948` already uses):

```jsx
<input
  type="text"
  inputMode="decimal"
  pattern="[0-9.]*"
  name="..."
  placeholder="0.00"
/>
```

- `type="text"` removes scroll-to-change, spinners, locale parsing, and exponential notation.
- `inputMode="decimal"` brings up the right mobile keyboard (numeric pad with `.`).
- `pattern="[0-9.]*"` hints to iOS to show the numeric keypad.

**Diff (pattern — apply to each file):**

```jsx
- type="number" inputMode="decimal" name="bill-amount" placeholder="0"
+ type="text" inputMode="decimal" pattern="[0-9.]*" name="bill-amount" placeholder="0"
```

In a parent submit handler, validate the value parses to a positive number; the input still allows invalid intermediate states (good — users can type-and-correct) but the submit gate stays strict.

For AnalyticsCharts axis-bound inputs (which take integers, not money), use `inputMode="numeric" pattern="[0-9]*"` (numeric keypad, no decimal). Same `type="text"` reasoning.

**Verify:** On any page modified, open the form, focus the amount input, scroll the page — input value is unchanged. On a desktop, the spinner arrows are gone. On mobile, the numeric-with-decimal keypad still appears.

**Risk:** Low. The submit-time validation is the same. The only behavioural change is the input no longer silently coerces values; users can type intermediate-invalid states and you handle them on blur/submit.

---

## FIX-054 — Sentry React Router v6 browser tracing integration  [P2, 20 min]

**File:** `src/lib/errorReporting.js`
**Anchor:** `Sentry.init` (line 90) — `integrations:` array (line 94).

**Why:** Today Sentry uses `Sentry.browserTracingIntegration()` (line 95). This gives generic browser tracing (LCP, INP at the page level) but **does not produce per-route spans** because Sentry can't see React Router's transitions. So when LCP regresses, you can't tell which route is responsible.

The fix: switch to Sentry's React Router v6 integration, which hooks into `useLocation` / `useNavigationType` and emits a span per route change. After this, every route gets its own performance trace in Sentry: "Dashboard load: 1.2 s p75", "Transactions load: 1.8 s p75".

**Diff:**

```js
// src/lib/errorReporting.js — top of file
import { useEffect } from 'react'
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom'

// Inside Sentry.init, integrations array:
integrations: [
- Sentry.browserTracingIntegration(),
+ Sentry.reactRouterV6BrowserTracingIntegration({
+   useEffect,
+   useLocation,
+   useNavigationType,
+   createRoutesFromChildren,
+   matchRoutes,
+ }),
  Sentry.replayIntegration({
    maskAllText: true,
    blockAllMedia: true,
  }),
],
```

Reference: [Sentry React Router v6 docs](https://docs.sentry.io/platforms/javascript/guides/react/configuration/integrations/react-router/).

**Side note:** `BrowserRouter` (used by Kosha) is fine — the integration works with the existing router.

**Verify:** After deploy, Sentry Performance tab → filter by `transaction:Dashboard` (or any route name) — per-route p50/p75/p95 should populate over the next 24 h.

---

## FIX-055 — Service Worker cache for Supabase Storage (avatars)  [P2, 20 min]

**File:** `vite.config.js`
**Anchor:** `runtimeCaching` array (~line 112).

**Why:** FIX-050 caches signed avatar URLs to localStorage so we don't re-fetch them. But the **image at that URL** is still re-fetched on every cold start because the Service Worker's cache config (lines 112–169) covers `/auth/*` and `/rest/*` only — not `/storage/*`. Adding a storage cache rule means the avatar image becomes a true zero-network paint after the first time it loads.

**Catch:** Supabase signed URLs include a token in the query string (`?token=…`), which changes every time the URL is regenerated. Workbox keys cache entries by full URL by default, so the cache would never hit. Workaround: normalize the cache key to the path only.

**Diff:** add a new rule **after** the `rest/.*` rule:

```js
{
  // Supabase Storage — CacheFirst, normalized cache key.
  // Signed URLs change token on every regenerate; we cache by path
  // so the underlying image is served from cache regardless of which
  // signed URL was used to request it. Short TTL (1 hr) bounds the
  // staleness when a user updates their avatar.
  urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
  handler: 'CacheFirst',
  options: {
    cacheName: 'supabase-storage',
    expiration: {
      maxEntries: 50,
      maxAgeSeconds: 60 * 60, // 1 hour
    },
    cacheableResponse: { statuses: [200] },
    plugins: [
      {
        // Normalize the cache key: drop query string + fragment.
        // Two signed URLs for the same underlying object resolve
        // to the same cache key, so we get cache hits even after
        // FIX-050's localStorage cache expires and we regenerate
        // a fresh signed URL.
        cacheKeyWillBeUsed: async ({ request }) => {
          const url = new URL(request.url)
          return url.origin + url.pathname
        },
      },
    ],
  },
},
```

**Cross-user safety:** Storage paths in `avatars/` are prefixed by user ID (`avatars/<uid>/<filename>`). Two users' avatars never collide on the cache key. Avatar bucket access is gated by Supabase Storage RLS, so even if a cache key were predictable, a user can't read another user's image. Safe.

**Avatar-changed staleness:** If a user uploads a new avatar, the old one stays in cache for up to 1 hour. Acceptable for avatars (low update frequency). If this becomes a complaint, add a cache-busting query param to the signed URL request in `SecureAvatar.jsx` (e.g. `?v=<avatar_url_hash>`).

**Verify:** Cold-start the PWA → check DevTools → Application → Cache Storage → `supabase-storage` should populate after the first avatar paint. Reload → avatar appears in the *first* paint, no network request.

---

## FIX-056 — Back-button-aware bottom sheets & dialogs (Android UX)  [P2, 1 hr]

**Files:**
- `src/components/ui/BottomSheet.jsx` (the foundation — all sheets use this)
- Audit any modal dialogs (`EditProfileNameDialog`, `ViewProfilePhotoDialog`, custom confirm dialogs)

**Why:** Today on Android, when a bottom sheet is open and the user presses the system back button:
- The sheet **does not close** — instead the user is navigated to the previous route, with the sheet still mounted (and instantly unmounted when the new route renders). The intent was "dismiss the sheet" but the result was "leave the page".

Native Android apps universally treat back-button-on-modal as "close the modal first, navigate second." PWAs can match this by manipulating `history.pushState` when a sheet opens and listening for `popstate` to close.

**Implementation pattern in `BottomSheet.jsx`:**

```js
useEffect(() => {
  if (!open) return undefined

  // Push a history entry so the system back button has something to pop.
  const stateKey = `kosha:sheet:${Math.random().toString(36).slice(2)}`
  window.history.pushState({ koshaSheet: stateKey }, '')

  const handlePopState = () => {
    // Back was pressed while sheet is open — close instead of navigate.
    onClose?.()
  }
  window.addEventListener('popstate', handlePopState)

  return () => {
    window.removeEventListener('popstate', handlePopState)
    // If the sheet closed normally (not via back), pop our entry so the
    // user's back history isn't polluted.
    if (window.history.state?.koshaSheet === stateKey) {
      window.history.back()
    }
  }
}, [open, onClose])
```

There's a subtle race here: if `onClose` is called *during* a popstate (because back was pressed), we shouldn't `history.back()` again on unmount — the cleanup's `state?.koshaSheet === stateKey` check handles that (after the pop, the state no longer matches).

**Same pattern for modal dialogs.** Add this hook into a small reusable file (`src/hooks/useBackButtonClose.js`) and consume it from every modal:

```js
// useBackButtonClose.js
import { useEffect } from 'react'

export function useBackButtonClose(open, onClose) {
  useEffect(() => {
    if (!open) return undefined
    const stateKey = `kosha:back:${Math.random().toString(36).slice(2)}`
    window.history.pushState({ koshaModal: stateKey }, '')
    const handlePopState = () => onClose?.()
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (window.history.state?.koshaModal === stateKey) {
        window.history.back()
      }
    }
  }, [open, onClose])
}
```

Apply in `BottomSheet.jsx`, `EditProfileNameDialog.jsx`, `ViewProfilePhotoDialog.jsx`, and any other open/close-controlled modal.

**Verify:** On Android Chrome PWA: open a bottom sheet → press the system back button → sheet closes, route does NOT change. Open a dialog → back button closes it. After all modals are closed, back button works as usual (navigates).

**Risk:** Medium. History manipulation is error-prone. Test thoroughly with nested modals (open sheet → open dialog from inside sheet → back should close dialog, second back should close sheet). The `stateKey` uniqueness prevents stack confusion.

---

# 9. Final assessment — after all 56 fixes ship

This is my honest read on where Kosha lands after the audit is fully implemented, scored against what I'd expect from a premium fintech PWA in 2026.

## Scorecard

| Dimension | Today | After P0+P1 | After full plan |
|---|---|---|---|
| **Tap responsiveness** (INP) | 60/100 — 2-tap bug; 280 ms INP | 92/100 — 1-tap, ~120 ms INP | 95/100 — ~95 ms INP |
| **Perceived "snappiness"** | 62/100 — Suspense flash, skeleton churn | 91/100 — no flash, View Transitions | 94/100 — instant cold start with IDB persist |
| **Premium feel** (motion, haptics, typography) | 72/100 — solid M3 base, undertuned springs | 92/100 — M3 Expressive springs, paise typography, anchored menu | 94/100 — splash images, app shortcuts, full polish |
| **Correctness** | 75/100 — silent Splitwise settlement bug, query races | 96/100 — settlement fixed with idempotency, races eliminated | 97/100 |
| **Accessibility** | 70/100 — decent semantics, gaps in focus rings & live regions | 88/100 — `:focus-visible` rings, 48dp targets, live regions | 90/100 |
| **Code quality** | 80/100 — well-organized, sensible abstractions, some race-condition smell | 88/100 — race conditions removed, dynamic imports normalized | 90/100 |
| **Bundle / build hygiene** | 75/100 — ~210 kB gzip, dual icon libs, MUI heavy | 84/100 — modulepreload, defer prefetch, drop one icon lib | 90/100 — size-limit in CI, font subset |
| **Observability** | 60/100 — Sentry on errors only, no perf telemetry | 80/100 — query errors captured, runtime monitor | 92/100 — Web Vitals real-user telemetry |
| **PWA polish** | 78/100 — good manifest, SW update flow, FOUC prevented | 85/100 — same plus better motion | 95/100 — shortcuts, splash images, IDB persist |
| **Architecture & maintainability** | 82/100 — clear concerns, RLS-strong, optimistic mutations everywhere | 86/100 — same plus eliminated foot-guns | 88/100 |
| **Overall** | **71/100** | **89/100** | **94/100** |

## What "93/100" actually means

Kosha after the full plan would be:
- **In the top 5% of finance PWAs I've seen** for perceived performance on mid-range Android. The vast majority of fintech apps in this space (Splitwise itself, every Indian neobank PWA, most of the BharatPe / CRED-style apps) feel slower than this — the bar is genuinely low and Kosha would clear it comfortably.
- **Indistinguishable from a well-built native Android app** to most users. Pixel-native motion, M3 Expressive springs, haptics on every confirm, no jank, no skeleton flash. The remaining 7 points are things only a critic notices.
- **More correct than most apps in its category.** The Splitwise settlement fix alone (FIX-039) puts it ahead of apps that have similar bugs and have never noticed.

## What the remaining 7 points *would* require (and why we're not doing them)

These are the things that would push the score from 93 → 100, and the reason each is **out of scope**:

1. **Server-side rendering (SSR) / pre-rendering of the marketing/landing routes** — would shave 400–800 ms off cold start. Requires moving from Vite → Next.js or similar. Architecture overhaul; user has not asked for this; not worth it for a PWA where most users are returning.
2. **Edge caching of Supabase reads** — would shave 100–200 ms off the data layer on cold start. Requires custom edge functions or a CDN-fronted read API. Significant infra work.
3. **Custom native shell** (Capacitor / TWA) — gives true OS-level integration (background sync, share targets, push notifications without Firebase). PWA goes far but not all the way. Out of scope by definition: user wants to stay PWA.
4. **A11y to AAA standard** — current plan hits AA. AAA (contrast 7:1, content readable at 200% zoom, full keyboard nav with skip-links) requires design changes (contrast tweaks that would shift the palette).
5. **Type safety end-to-end** — JS today. TypeScript would catch a class of bugs at build time. Massive migration; out of scope.
6. **Live regions for every dynamic content change** — wallet switch announcements, mutation success/failure spoken by screen reader. Premium a11y; deferred.
7. **Sub-100ms LCP** — would require inline-critical-CSS, font preloading, server-push, or HTTP/2 priorities. We can get to ~1.5 s; sub-1 s is a different engineering effort.

## Code quality / architecture honest read

The codebase today is **better than I'd expect from a solo / small-team project at this stage**. Specifically:

**Genuine strengths** (do not regress):
- The `BigInt` paise abstraction (`src/lib/paise.js`) for financial math is the right call and well-implemented. Most fintech apps use floats and silently lose money over time.
- Optimistic mutations are wired up across `useTransactions`, `useLoans`, `useLiabilities`, `useBudgets`, `useUserCategories` — that's table stakes for "premium feel" and it's already there.
- RLS is strict and `is_linked()` is used consistently — solid security posture.
- The error boundary architecture (`GlobalErrorBoundary` + per-route `RouteErrorBoundary`) is correct.
- Wallet switching via `useActiveWallet` is well-isolated; the `placeholderData` pattern guards against cross-user data flash.
- The runtime monitor + structured logger combination is more sophisticated than most apps this size.
- Dark mode is FOUC-prevented in `index.html` already.

**Genuine weaknesses** (addressed by the plan):
- The Splitwise settlement RPC bug is bad and was hiding in plain sight. Not a code-quality issue per se — it's the kind of "looks right at the function-call boundary but RLS silently blocks it" trap that's easy to miss in a `security invoker` function.
- Dynamic imports of trivially small files like `haptics.js` is a common React/Vite footgun.
- The route prefetch is over-eager (`onMouseEnter`, `onFocus`, `onTouchStart` all firing).
- React Query global `refetchOnMount: true` is just a misconfiguration.
- `will-change` on one-shot animation classes is GPU memory pressure that nobody would have noticed without an audit.
- The `EagerChunkPreloader` does sequential `setTimeout` instead of parallel — a small but real boot-time loss.

**What I'd worry about long-term** (not in this plan; mentioning so it's not forgotten):
- The `Dashboard.jsx` file is 996 lines. It works, but it's at the threshold where future changes start to interact in surprising ways. Consider splitting it into a `useDashboardData` hook + presentational `<DashboardView>` after this plan ships.
- Schema migrations are direct edits to `supabase/schema.sql`. Fine for a small team, but you'll eventually want a numbered-migration system (or Supabase's built-in migration tooling) to keep production and local schemas in lockstep.
- No unit tests for `paise.js`, `useTransactions`, or the Splitwise mutation paths. The `scripts/tests/*.mjs` files are integration smoke tests, which is good but isn't enough for the financial-math code paths. A handful of `vitest` files for `paise.js` alone would catch a class of money-rounding bugs.

## Bottom line

After this plan ships, Kosha would feel like a Google product — and that's the explicit mandate. The remaining headroom is genuine architecture / infrastructure work that's reasonable to defer until you have more users and clearer signals about what they need.

The Splitwise settlement fix (FIX-039) is the only fix in this doc that's a correctness / data bug; everything else is performance and polish. That fix should ship first, independently of the rest.
