# Agent Handoff — Remaining Audit Batches (4, 5, 6, 8, 9)

> **Read this in full before touching code.** It is the contract between you and the human reviewer. The exhaustive rationale lives in [`docs/AUDIT_REPORT.md`](./AUDIT_REPORT.md); this document is the executable summary.

## 0. Status

| Batch | State | Notes |
|---|---|---|
| 1 — Stop the bleeding | **DONE & in prod** | Don't re-touch |
| 2 — Sign-out & shared-device cache | **DONE & in prod** | User-scoped cache keys (`#kosha-uid=<id>` SW URL fragment) — preserve this pattern |
| 3 — Server-side atomicity & audit | **DONE & in prod** | `financial_events` is now **write-only via DB triggers**. Client `auditLog.js` is a documented no-op. Do not reintroduce client writes. |
| 4 — Money math foundation | **TO DO** | Start here |
| 5 — Form validation & wallet-switch | **TO DO** | Depends on Batch 4 (`validateAmount`) |
| 6 — Dashboard NaN & date guards | **TO DO** | Depends on Batch 4 (`safeNumber`, `dayKey`) |
| 7 — Security headers & avatar | **DONE & in prod** | Don't re-touch |
| 8 — Optimistic update hardening | **TO DO** | Independent; depends on Batch 4 for `paise.js` in one place |
| 9 — CI, tests, docs | **TO DO** | Last — needs everything above to be stable |

**Ship order (mandatory):** 4 → 5 → 6 → 8 → 9. Each batch is ONE PR. Do not interleave.

---

## 1. Repo orientation

- **Stack:** React 18, React Router 6, @tanstack/react-query v5, Supabase (Postgres + Auth + Realtime + Storage + Edge Functions), Tailwind 3, Framer Motion 11, Vite 5, vite-plugin-pwa, Vercel.
- **Money everywhere is currently JS Number** (rupees with `.toFixed(2)`). Batch 4 introduces integer paise.
- **Realtime is wired** on `transactions`, `liabilities`, `loans`, `split_*`. Mutations optimistically write to React Query cache, server cascades back over realtime.
- **Audit trail** is `public.financial_events`, written by DB triggers only. Read shape: `{ created_at, user_id, action, entity_type, entity_id, metadata }`. Action enum lives in `src/lib/auditLog.js`.
- **Tests:** `npm run test:*` (no-network static checks) and `npm run test:integration` (hits Supabase). CI is in `.github/workflows/ci.yml` but currently swallows missing-secret failures — Batch 9 fixes that.

## 2. Pre-flight rules (lessons learned the hard way)

1. **Never use `SET LOCAL row_security = off` inside SECURITY DEFINER trigger functions.** `SET LOCAL` is transaction-scoped, not subtransaction-scoped, so it persists past your `EXCEPTION` block into the next trigger on the same row. Use `BYPASSRLS` on the function owner (the `postgres` role in Supabase already has it).
2. **Any new query that should be cache-isolated per user must use the `#kosha-uid=<id>` URL-fragment pattern** that Batch 2 introduced (see `src/lib/walletStore.js` and how `useTransactions` constructs its query key). Do not add a new caller that omits this.
3. **The audit log is server-side only.** Adding `logFinancialEvent` calls back to the client is a regression — the function is a no-op. Activity-feed reads still happen via `useFinancialEvents` (unchanged).
4. **Atomic-delete RPCs exist for liabilities, loans, split expenses, split settlements, partner unlink.** Use them instead of multi-table deletes from the client.
5. **Do NOT loosen `Content-Security-Policy` in `vercel.json`** without explicit user approval. Same for `Strict-Transport-Security`.
6. **Sentry `beforeSend` scrubs PII.** If you add a new field to error events, verify it isn't a sensitive key pattern (see `SENSITIVE_KEY_PATTERNS` in `src/lib/errorReporting.js`).
7. **Test ANY DB change against a real DELETE/UPDATE/INSERT in the app, not just SQL.** Static contract tests pass even when triggers explode at runtime.
8. **Production has no staging clone.** Migrations must be idempotent and have a documented rollback. Use the pattern in `supabase/migrations/0004_atomicity_and_audit.sql` (BEGIN/COMMIT, `if exists` everywhere, rollback block in comments).

---

## 3. Batch 4 — Money math foundation

**Goal:** Stop using JS floats for money. Introduce four reusable helpers. Re-route legacy helpers to them. Fix Splitwise rounding/sign bugs, CSV injection, and statement-import parsing.

**Risk:** Low (client-only, no DB). **Verification surface:** existing Splitwise groups must still settle to the same totals; CSV export must still open in Excel; statement import must still match transactions.

### Files (4 new, 7 edited)

| # | File | Change |
|---|---|---|
| 1 | NEW `src/lib/paise.js` | Export `fromRupees(n)`, `toRupees(p)`, `add`, `sub`, `mul`, `divEvenly(total, n)`. Internal representation = `bigint` (or plain integer if you're confident inputs are bounded; pick one and document). `divEvenly` returns array of `n` integers summing exactly to `total`, with remainder distributed +1 to the first `r` shares. |
| 2 | NEW `src/lib/safeNumber.js` | `safeNumber(value, fallback = 0)` — `Number.isFinite(value) ? value : fallback`. Use everywhere a number reaches `style={{ '--x': value }}`, a Recharts `domain`, or a `/` denominator. |
| 3 | NEW `src/lib/validateAmount.js` | `validateAmount(input, { min = 0, max = 9999999999, allowZero = false, allowFuture = false } = {})` → `{ ok: true, paise: bigint } \| { ok: false, error: string }`. Rejects `NaN`, `Infinity`, scientific notation, leading `+`, more than 2 decimal places. |
| 4 | NEW `src/lib/dayKey.js` | `dayKey(date, timezone = userTimezone())` → `'YYYY-MM-DD'`. Anchors at local noon to avoid DST cell-shift. `userTimezone()` reads `Intl.DateTimeFormat().resolvedOptions().timeZone`. |
| 5 | `src/lib/utils.js` | Replace local `round2`, `groupByDate`, `dateDistanceDays` with re-exports from the new modules. Keep export names stable (callers don't change). |
| 6 | `src/lib/splitwiseMath.js` | Use `paise.divEvenly` for share computation. Remove the `+ Number.EPSILON` rounding hack — it rounds negatives the wrong way. Sort creditors/debtors by `abs(balance)` descending before the greedy match. Stop early-returning zero on refund amounts (preserve sign). Throw if payer_id or split_member_id is missing from group membership. |
| 7 | `src/lib/csv.js` | Before writing any cell, if `cell[0]` matches `/^[=+\-@\t\r]/`, prefix with a single quote `'`. Quote-wrap and double-quote-escape per RFC 4180. |
| 8 | `src/lib/statementMatching.js` | Use a real CSV tokenizer (quoted fields). Accept Indian-lakh notation (`1,00,000`), `₹`, Unicode minus `\u2212`, and date forms `dd MMM yyyy` / `dd-MM-yy`. Stop calling `.replace(/\D/g, '')` on merchant tokens — preserve digits. |
| 9 | `src/lib/reconciliation.js` | Add alias-quality gate: do not call `learnAlias(...)` when `confidence < 0.75`. Add greedy 1:1 assignment so one transaction matches at most one statement entry. |
| 10 | `src/lib/reconciliationMetrics.js` | Replace `String(updated_at) >= cutoff` with `new Date(updated_at) >= cutoff`. Treat missing `updated_at` as "unknown" (separate bucket), not as epoch zero. |
| 11 | `src/lib/weeklyDrift.js` | Replace local date-bucket logic with `dayKey()`. |

### Acceptance criteria

- `npm run test:money` (you'll add this — see below) passes; existing tests still pass.
- Manual: take an existing splitwise group with at least 4 members and a refund; confirm the per-member totals add up to the expense total exactly (no `.01` leftover).
- Manual: export a transaction CSV containing a row with description `=cmd|'/c calc'!A1` and open it in Excel/Google Sheets — the cell shows the literal string, no formula.
- Manual: import a Kotak or HDFC statement (any Indian bank CSV); confirm merchants with commas (e.g. `Amazon Pay India Pvt Ltd, Bangalore`) match correctly.

### Add a test

Create `scripts/tests/test_money_math.mjs` with at least:

- `paise.divEvenly(100, 3)` → `[34, 33, 33]` and sum equals 100.
- `paise.divEvenly(-100, 3)` → `[-34, -33, -33]`.
- `safeNumber(Infinity, 0)` → `0`; `safeNumber(NaN, 0)` → `0`; `safeNumber(42)` → `42`.
- `validateAmount('1e9')` → `{ ok: false }`; `validateAmount('1.234')` → `{ ok: false }`; `validateAmount('100.50')` → `{ ok: true, paise: 10050n }`.

Register the script in `package.json` as `"test:money": "node scripts/tests/test_money_math.mjs"`.

### Rollback

Revert the commit. No DB changes.

---

## 4. Batch 5 — Form validation & wallet-switch guard

**Goal:** Close the wallet-mid-edit data-loss path. Unify amount/date validation behind Batch 4 helpers. Add double-submit guards. Validate uploads by MIME, not extension.

**Risk:** Medium (touches every form sheet). **Verification surface:** every "add" / "edit" sheet across Transactions, Bills, Loans, Categories, Splitwise.

### Files (12 edits, 1 new)

| # | File | Change |
|---|---|---|
| 1 | NEW `src/components/ui/FormField.jsx` | Wraps `AmountInput` / `Input` and threads `validateAmount` into a single `error` state. Surfaces inline error text. |
| 2 | `src/App.jsx` | On `useActiveWallet()` change, dispatch a synthetic `bottomsheet:close-all` event (or call a `closeAll()` from a sheet registry). Also wrap the app in `<MotionConfig reducedMotion="user">`. |
| 3 | `src/components/transactions/AddTransactionSheet.jsx` | Use `<FormField>` for amount. Replace `<input type="number">` with `<input type="text" inputMode="decimal" pattern="[0-9.]*">`. Disable submit button while mutation is pending; track `isSubmitting` ref to prevent double-fires. |
| 4 | `src/components/categories/BudgetSheet.jsx` | Same pattern. |
| 5 | `src/components/categories/CreateCategorySheet.jsx` | Same. |
| 6 | `src/components/obligations/Bills.jsx` | Wrap "Mark paid" handler in single-flight guard (use existing `mutationGuard.js` or a local `useRef(false)`). |
| 7 | `src/components/obligations/Loans.jsx` | Same for "Settle". |
| 8 | `src/pages/Splitwise.jsx` | Compute sum of exact splits; reject if `sum !== total`. Compute sum of percent splits; reject if `sum !== 10000` (in basis points to avoid float compare). Cross-currency settle-up: if `expense.currency !== settlement.currency`, show a warning toast and block submit. |
| 9 | `src/pages/Onboarding.jsx` | Wrap `updateProfile()` in try/catch and surface error via existing toast system. |
| 10 | `src/pages/ReportBug.jsx` | Read first 16 bytes of selected file with `FileReader`; check magic bytes for png/jpg/pdf. Reject if MIME does not match extension. |
| 11 | `src/pages/Settings.jsx` | Same MIME check for avatar upload before sending to Supabase Storage. |
| 12 | `src/components/ui/AmountInput.jsx` | `inputMode="decimal"`, `pattern="[0-9.]*"`, `autoComplete="off"`. Strip leading `+`, reject scientific notation in `onChange`. |
| 13 | `src/components/ui/PixelDatePicker.jsx` | Add `onKeyDown` handling: Arrow ←→↑↓ move 1/7 days, PageUp/Down move 1 month, Home/End move to month start/end, Esc closes. |

### Acceptance criteria

- Reproduce the wallet-switch bug pre-fix: open Add Transaction, switch wallets, save → before fix lands in wrong wallet; after fix, the sheet closes when wallet switches. (Manual.)
- Submit a transaction form twice within 200ms → only one row in DB.
- Try to upload a `.pdf` renamed to `.jpg` as avatar → rejected with clear error.
- Existing exact and percent split flows still work for valid inputs.

### Rollback

Revert the commit. No DB changes.

---

## 5. Batch 6 — Dashboard / charts NaN and date guards

**Goal:** Stop showing `NaN%`, `−140% improvement`, broken Recharts, and time-drifting bill-payment metrics.

**Risk:** Low–medium. **Schema change:** one column `paid_at timestamptz` on `liabilities`, plus a backfill.

### Files (16 edits, 1 schema migration)

| # | File | Change |
|---|---|---|
| 1 | `src/components/cards/dashboard/DashboardHeroCard.jsx` | `safeNumber()` every value before it hits a CSS var or `/`. |
| 2 | `src/components/cards/monthly/MonthHeroCard.jsx` | Clamp `month` to `[1, 12]` before `MONTH_NAMES[month - 1]`. |
| 3 | `src/components/cards/monthly/DailySpendTrend.jsx` | Use `dayKey()` from Batch 4. Memoize the chart data array with `useMemo`. |
| 4 | `src/components/cards/monthly/MerchantIntelCard.jsx` | Use the "largest-remainder" method so percent shares sum to exactly 100. |
| 5 | `src/components/cards/bills/BillPaymentInsights.jsx` | Use `liability.paid_at` for late/on-time/streak metrics. Fall back to `liability.updated_at` only if `paid_at IS NULL`. |
| 6 | `src/components/cards/analytics/InvestmentConsistencyCard.jsx` | When iterating months, break the streak when a month has zero investment transactions instead of skipping. |
| 7 | `src/components/cards/analytics/CalendarHeatmap.jsx` | Construct each cell's date as `new Date(year, monthIdx, day, 12, 0, 0)` (anchor at noon) then `dayKey()`. |
| 8 | `src/components/cards/analytics/YearlyPortfolioSnapshotCard.jsx` | If `vehicleData` is `null`/`undefined`/non-array, render empty state instead of crashing. |
| 9 | `src/components/cards/analytics/YearOverYearCards.jsx` | Delta-pct denominator = `Math.abs(prior) || 1` (not raw `prior`). |
| 10 | `src/components/dashboard/SpendingPaceTracker.jsx` | If `driftPct == null`, render "—" not the positive-drift styling. |
| 11 | `src/components/dashboard/DashboardRecentTransactions.jsx` | Resolve `investment_vehicle` UUIDs against `INVESTMENT_VEHICLES` map before display; fall back to "Investment". |
| 12 | `src/components/analytics/AnalyticsCharts.jsx` | (a) When user has edited corpus, do NOT overwrite on next query. (b) Filter `Infinity` and `-Infinity` from runway-coverage data before passing to Recharts. (c) Throttle haptic vibration to `dragstart`/`dragend` events, not `pointermove`. (d) Replace hex `#003366` with token `var(--ds-color-chart-1)` (define if missing). (e) Memoize data arrays. |
| 13 | `src/components/common/PortfolioMixDonut.jsx` | Filter out rows where `value == null`. Floor `degrees = Math.max(0, computed)` in the conic gradient. |
| 14 | `src/components/ui/Card.jsx` | Read `useReducedMotion()` from framer-motion; pass `whileHover={{}}` and `whileTap={{}}` when reduced. |
| 15 | `src/index.css` | Declare `--ds-ease-standard: cubic-bezier(0.4, 0, 0.2, 1)` and `--ds-motion-fast: 150ms`. Change the `prefers-reduced-motion *` reset to scope only `animation` and `transition` properties; preserve `outline` and focus rings. |
| 16 | `src/lib/muiTheme.js` | Wrap the `:active` scale animation in `@media (prefers-reduced-motion: no-preference)`. |

### Schema change (the only one in remaining batches)

Create `supabase/migrations/0005_liability_paid_at.sql`:

```sql
begin;

-- Add column (idempotent)
alter table public.liabilities
  add column if not exists paid_at timestamptz;

-- Backfill from existing linked transactions where the bill is already paid
update public.liabilities l
set paid_at = t.date::timestamptz
from public.transactions t
where l.paid = true
  and l.paid_at is null
  and t.linked_bill_id = l.id;

-- For any still-null paid+true rows (no linked txn), use updated_at as a best-effort
update public.liabilities
set paid_at = updated_at
where paid = true and paid_at is null;

commit;

-- Rollback (manual):
-- alter table public.liabilities drop column paid_at;
```

Also append the same `add column if not exists` to `supabase/schema.sql` for full-rebuild parity.

In `src/hooks/useLiabilities.js`, update the `markAsPaid` mutation to also set `paid_at: new Date().toISOString()` in the update payload.

### Acceptance criteria

- Open Dashboard with a fresh user (no data) → no `NaN`, no `Infinity`, no crashes.
- Bill marked paid today → BillPaymentInsights shows "0 days late". 30 days later, still "0 days late" for that same bill (the metric is now anchored on `paid_at`, not "today minus due_date").
- Open Analytics on a phone with iOS Low Power Mode (reduced motion) → no card hover animations.
- Calendar heatmap looks identical for users in `Asia/Kolkata` vs `America/Los_Angeles` (no off-by-one cells).

### Rollback

Revert the commit. Run the `alter table drop column` from the migration comment.

---

## 6. Batch 8 — Optimistic update hardening

**Goal:** Kill the search-filter `ReferenceError`, the double-tap duplicate rows, the loan ghost-transaction, and the sign-out crashes.

**Risk:** Medium. Touches hot paths that already work for the common case. Test every mutation.

### Files (9 edits)

| # | File | Change |
|---|---|---|
| 1 | `src/lib/mutationGuard.js` | Add `withOptimisticGuard(key, fn)`: cancels in-flight queries on the key set BEFORE invoking `fn`. Uses `crypto.randomUUID()` for optimistic IDs (no `Date.now()`). Maintains a single in-flight token per key — second call within the window rejects with `OPTIMISTIC_BUSY`. |
| 2 | `src/hooks/useTransactions.js` | Import the existing `normalizeSearchNeedle` and `CATEGORY_LABEL_BY_ID` helpers (currently undefined references at the search-filter call site). Add a stable sort tiebreaker on `id` after `date`. Pass `signal: AbortController.signal` to the Supabase query in `queryFn`. |
| 3 | `src/hooks/useLiabilities.js` | Wrap `addLiability` / `markAsPaid` / `deleteLiability` in `withOptimisticGuard`. Add `AbortController` to the list query. |
| 4 | `src/hooks/useLoans.js` | In the `disburse` mutation's `onSuccess`, ALWAYS call `queryClient.setQueryData` to remove the optimistic transaction by tempId (don't gate on `result.transaction_id`). Add `AbortController`. |
| 5 | `src/hooks/useSplitwise.js` | Wrap every `getAuthUserId()` call in `try { … } catch { return null }`. Normalize RPC return shape: some return `[obj]`, some return `obj` — coerce to single object. |
| 6 | `src/hooks/useBudgets.js` | `withOptimisticGuard` around create/update/delete. |
| 7 | `src/hooks/useUserCategories.js` | The `useEffect` that registers default categories has `userCategories` in its deps and writes to the same query → infinite loop. Use a ref to track "registered once" or move the registration to a lazy initialization in the query's `select`. |
| 8 | `src/hooks/useFinancialEvents.js` | Simplify: Batch 3 made this read-only. Remove the `optimisticallyInsertFinancialEvent` function and all callers (search the repo). The DB trigger handles writes. |
| 9 | `src/hooks/useReconciliationReviews.js` | `AbortController` + stable query keys (include user id and wallet id). |

### Acceptance criteria

- With a search filter active in Transactions, add a transaction → it appears in the list without a console `ReferenceError`.
- Tap "Mark paid" three times in 200ms on the same bill → only one DB update.
- Disburse a loan → optimistic row appears immediately. After server responds → exactly one transaction row remains (no duplicate, no ghost).
- Sign out while on Splitwise page → no error toast, page navigates cleanly.
- Search by category name (`Food`) → still works (the import fix didn't break the happy path).
- Run `npm run test:mutation-paths` and `npm run test:mutation-rollback-contract` — both pass.

### Rollback

Revert the commit. No DB changes.

---

## 7. Batch 9 — CI, tests, docs, release process

**Goal:** Make the build trustworthy. Right now CI passes when secrets are missing and "tests" don't fail when they should.

**Risk:** Very low for runtime; medium for blocking PRs. Coordinate with user before merging — first run of strict CI may surface unrelated lints.

### Files (16 edits, 2 new)

| # | File | Change |
|---|---|---|
| 1 | `.github/workflows/ci.yml` | (a) Drop the `continue-on-error: true` on the secrets check; instead, fail if `github.event.pull_request.head.repo.full_name == github.repository` AND secrets are missing. (b) Add `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`. (c) Add `unit-tests` job running `npm run test:no-network`. (d) Add `lint` job running `npm run lint`. (e) Add `version-changelog-check` job: parses `package.json` version and asserts it appears in `src/lib/changelog.js`. |
| 2 | NEW `eslint.config.js` | Flat config. Plugins: `eslint-plugin-react@7`, `eslint-plugin-react-hooks@4`, `eslint-plugin-jsx-a11y@6`. Rules: `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: warn`, `no-unused-vars: [warn, { argsIgnorePattern: '^_' }]`, `no-undef: error`. |
| 3 | NEW `.nvmrc` | `22` |
| 4 | `package.json` | Add `"engines": { "node": ">=22" }`. Add `"lint": "eslint src scripts"` and `"lint:fix": "eslint src scripts --fix"`. Add `"test:no-network": "npm run test:money && npm run test:mutation-paths && npm run test:mutation-rollback-contract && npm run test:wallet-cache-scoping"`. |
| 5 | `scripts/tests/test_wallet_cache_scoping.mjs` | Currently asserts a hardcoded list against itself. Rewrite to import the real `userScopedKey` from `src/lib/walletStore.js` and the real query-key factories from each hook; assert they all include the uid suffix. |
| 6 | `scripts/tests/test_mutation_paths.mjs` | Move under `lint:` prefix in package.json (it's a static grep, not a test). Same content. |
| 7 | `scripts/tests/test_mutation_integration_paths.mjs` | Same. |
| 8 | `scripts/tests/test_mutation_rollback_contract.mjs` | Same. |
| 9 | `scripts/tests/check_publication.mjs` | DELETE this file — it calls a missing RPC. Replace with `scripts/tests/check_publication_v2.mjs` that queries `pg_publication_tables` directly via the service-role client. |
| 10 | `scripts/tests/test_reconciliation_flow.mjs` | When it currently prints SKIP and exits 0, change to print SKIP to stderr and exit `process.env.CI ? 1 : 0`. |
| 11 | `scripts/ops/check_deploy_readiness.mjs` | The whitelist for expected `mark_liability_paid` errors is missing one message; add `'liability already paid'`. Rethrow anything not in the whitelist. |
| 12 | `scripts/ops/release_candidate_check.mjs` | Add three missing test invocations: `test:wallet-cache-scoping`, `test:reconciliation-insights`, `test:rls-partner-isolation`. Replace `retries \|\| 3` with `retries ?? 3` (0 should be allowed). |
| 13 | `README.md` | Regenerate file tree (use `tree -L 3 src/`). Fix broken refs to `useScrollDirection.js`, `Bills.jsx`, `Loans.jsx`. Add Splitwise tables + budget tables + bug-report Edge Function to Database setup. Add the 6 missing npm scripts. Add `SUPABASE_ANON_KEY` to Edge Function secrets. Document or remove `.references/material-web/` (currently broken submodule). |
| 14 | `scripts/README.md` | Regenerate. Remove dead reference to `scripts/archive/`. |
| 15 | `supabase/functions/bug-report-notify/README.md` | Add `SUPABASE_ANON_KEY` to required secrets list. |
| 16 | `.env.local.example` | Add `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `APP_URL`. |
| 17 | `.gitmodules` + `.references/material-web/` | EITHER remove (`git rm .gitmodules && git rm -rf .references/material-web`) OR init properly (`git submodule update --init --recursive`) and add a one-line README in `.references/material-web/README.md` explaining what it's for. **Confirm with user which path.** |
| 18 | `.gitignore` | Add lines: `.env.production`, `.vercel/`, `.idea/`, `coverage/`, `*.tsbuildinfo`. |

### Acceptance criteria

- Push a branch with `package.json` version `9.9.9` (not in changelog) → CI's `version-changelog-check` job fails.
- Push a branch with `console.log` left in `src/` → lint job warns (not fails, unless user wants strict).
- Trigger a CI run with `SUPABASE_SERVICE_ROLE_KEY` secret unset on a same-repo push → CI fails loudly. Same on a fork PR → skipped gracefully.
- `npm run test:no-network` runs offline on a fresh checkout in <30s.

### Rollback

Revert the commit. CI returns to its current permissive behaviour.

---

## 8. Cross-cutting verification (run after EACH batch lands)

```bash
# 1. Lint (Batch 9 onwards)
npm run lint

# 2. No-network test suite
npm run test:no-network

# 3. Build
npm run build

# 4. Integration tests (requires .env.local with Supabase creds)
npm run test:integration
```

Manual smoke (every batch): sign in → open Dashboard → add a transaction → mark a bill paid → add a splitwise expense → settle it → sign out → sign back in. Watch the browser console for new errors.

---

## 9. Commit and PR conventions

- One PR per batch. Title: `feat(batchN): <one-line summary>`.
- PR body must include:
  - Link to `docs/AUDIT_REPORT.md#batch-N`
  - List of files touched (you can paste the table from this doc)
  - Acceptance-criteria checklist with each item ticked
  - Rollback instruction (copy from this doc)
- Do not amend or force-push once a PR is open for review.
- Do not modify any file outside the batch's declared file list without flagging it in the PR body.

## 10. When to stop and ask the human

- Any time you need to widen a CSP, HSTS, or CORS rule.
- Any time you'd introduce a new dependency.
- Any time a migration is not idempotent.
- Any time a change would touch a file marked DONE in section 0.
- Any time a test fails that the batch description does not anticipate fixing.

---

*Source of truth: this document + [`docs/AUDIT_REPORT.md`](./AUDIT_REPORT.md). If the two disagree, this document wins for the remaining batches.*
