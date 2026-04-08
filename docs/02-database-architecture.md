# Chapter 2: Database Architecture & Backend

## 2.1 Architecture intent and migration posture

Kosha uses a single, idempotent Supabase SQL script as the backend contract source of truth: [supabase/schema.sql](supabase/schema.sql).
The script is intentionally written for repeated execution with patterns like:

1. Create if not exists for tables and indexes.
2. Drop policy if exists before create policy.
3. Guarded foreign key creation through pg_constraint checks.
4. Guarded realtime publication membership through pg_publication_tables checks.

Primary anchors:
- [supabase/schema.sql](supabase/schema.sql#L1)
- [supabase/schema.sql](supabase/schema.sql#L114)
- [supabase/schema.sql](supabase/schema.sql#L218)
- [supabase/schema.sql](supabase/schema.sql#L86)

This means onboarding a new environment and re-running schema on existing environments follow the same path with low drift risk.

---

## 2.2 Core relational schema (required entities)

## 2.2.1 Profiles

Definition:
- [supabase/schema.sql](supabase/schema.sql#L10)

Purpose:
- One row per authenticated user for app-level identity and onboarding state.

Key columns:
1. id as primary key and FK target to auth users.
2. display_name.
3. monthly_income.
4. onboarded.
5. created_at.
6. avatar_url.

FK contract:
- [supabase/schema.sql](supabase/schema.sql#L117)

Bootstrap trigger:
- New auth users auto-seed a profiles row using handle_new_user trigger function.
- [supabase/schema.sql](supabase/schema.sql#L302)
- [supabase/schema.sql](supabase/schema.sql#L323)

RLS:
- Enabled at [supabase/schema.sql](supabase/schema.sql#L212)
- Own-row select/insert/update policies at [supabase/schema.sql](supabase/schema.sql#L219) and [supabase/schema.sql](supabase/schema.sql#L336)

Operational impact:
- Frontend auth gate and onboarding depend on profile existence and onboarded state.
- [src/hooks/useAuth.js](src/hooks/useAuth.js#L20)
- [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L157)

---

## 2.2.2 Transactions

Definition:
- [supabase/schema.sql](supabase/schema.sql#L20)

Purpose:
- Canonical ledger for income, expense, and investment entries.
- Also stores generated recurring instances and linked entries created by RPCs (bill payments, loan payments).

Key financial columns:
1. date.
2. type with constrained enum-like check.
3. amount with positive constraint.
4. category.
5. investment_vehicle.
6. is_repayment.
7. payment_mode with constrained values.

Recurring engine columns:
1. is_recurring.
2. recurrence.
3. next_run_date.
4. source_transaction_id.
5. is_auto_generated.

Ownership:
- user_id FK added and enforced idempotently.
- [supabase/schema.sql](supabase/schema.sql#L67)
- [supabase/schema.sql](supabase/schema.sql#L131)

Performance indexes:
- General and composite user/date/type/category indexes.
- Trigram index for description search.
- Partial indexes for recurring and source linkage.
- [supabase/schema.sql](supabase/schema.sql#L180)

Realtime:
- Included in supabase_realtime publication.
- [supabase/schema.sql](supabase/schema.sql#L80)

RLS:
- Enabled at [supabase/schema.sql](supabase/schema.sql#L213)
- Own-row CRUD policies at [supabase/schema.sql](supabase/schema.sql#L235)
- Consolidated all-operation policy also exists at [supabase/schema.sql](supabase/schema.sql#L348)

Frontend usage:
- Core hook and query key engine:
  - [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L177)
- Recurring materialization RPC call:
  - [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L88)

---

## 2.2.3 Liabilities

Definition:
- [supabase/schema.sql](supabase/schema.sql#L43)

Purpose:
- Bill and due tracking domain.
- Supports recurring liabilities and linkage to generated expense transactions once paid.

Key columns:
1. description.
2. amount.
3. due_date.
4. is_recurring.
5. recurrence.
6. paid.
7. linked_transaction_id.

Ownership:
- user_id FK enforced via guarded DDL.
- [supabase/schema.sql](supabase/schema.sql#L145)

Indexes:
- due_date, paid, user_id, and linked transaction.
- [supabase/schema.sql](supabase/schema.sql#L201)

Realtime:
- Included in supabase_realtime publication.
- [supabase/schema.sql](supabase/schema.sql#L94)

RLS:
- Enabled at [supabase/schema.sql](supabase/schema.sql#L214)
- Own-row CRUD policies at [supabase/schema.sql](supabase/schema.sql#L256)
- Consolidated all-operation policy also exists at [supabase/schema.sql](supabase/schema.sql#L352)

Frontend usage:
- Query/mutation surfaces:
  - [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L42)
  - [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L154)

---

## 2.2.4 Budgets (important dual-structure note)

There are two budget-related tables in schema, but only one is actively wired in frontend.

Legacy-style budgets table:
- [supabase/schema.sql](supabase/schema.sql#L1037)
- RLS enabled at [supabase/schema.sql](supabase/schema.sql#L1049)
- No explicit policies are declared immediately after enabling RLS.

Active category budgets table:
- [supabase/schema.sql](supabase/schema.sql#L1096)
- Per-user per-category monthly_limit.
- Unique index user_id + category.
- Own-row CRUD policies at [supabase/schema.sql](supabase/schema.sql#L1126)

Actual frontend integration:
- The app reads and writes category_budgets, not public.budgets:
  - [src/hooks/useBudgets.js](src/hooks/useBudgets.js#L18)
  - [src/hooks/useBudgets.js](src/hooks/useBudgets.js#L59)

Architectural implication:
1. public.budgets currently behaves like a reserved or transitional table.
2. category_budgets is the real production budget data model.

---

## 2.2.5 Invites

Definition:
- [supabase/schema.sql](supabase/schema.sql#L57)

Purpose:
- One-time join-link mechanism between users.

Key columns:
1. token with secure random default.
2. created_by.
3. used_by.
4. used_at.
5. created_at.

FK constraints:
- created_by and used_by both reference auth users.
- [supabase/schema.sql](supabase/schema.sql#L159)
- [supabase/schema.sql](supabase/schema.sql#L174)

Index:
- token lookup index.
- [supabase/schema.sql](supabase/schema.sql#L209)

RLS:
- Enabled at [supabase/schema.sql](supabase/schema.sql#L215)
- Policies at [supabase/schema.sql](supabase/schema.sql#L277)

Frontend integration:
- Invite lifecycle utility module:
  - create, list, consume flows:
  - [src/lib/invites.js](src/lib/invites.js#L13)
  - [src/lib/invites.js](src/lib/invites.js#L39)
  - [src/lib/invites.js](src/lib/invites.js#L61)

Security nuance:
- Select policy uses true for authenticated users to allow token-based validation.
- Consumption safety is still enforced by update policy checks and used_by null semantics.
- [supabase/schema.sql](supabase/schema.sql#L277)
- [supabase/schema.sql](supabase/schema.sql#L287)

---

## 2.2.6 Bug reports

Definition:
- [supabase/schema.sql](supabase/schema.sql#L359)

Purpose:
- In-app bug reporting with triage metadata, duplicate fingerprinting, and notification support.

Phase 1 fields:
1. title, description, steps.
2. severity and status.
3. route, app_version, diagnostics.
4. user_id ownership.

Phase 2 extensions:
1. priority.
2. tags.
3. assignee.
4. duplicate_of.
5. fingerprint.
6. occurrence_count.
7. reporter_email.
8. screenshot_path.
9. environment.
10. lifecycle timestamps including triaged, resolved, notified.
- [supabase/schema.sql](supabase/schema.sql#L399)

Indexes:
- created_at, user, status, priority, last_reported, fingerprint+route.
- [supabase/schema.sql](supabase/schema.sql#L373)
- [supabase/schema.sql](supabase/schema.sql#L434)

RLS:
- Enabled at [supabase/schema.sql](supabase/schema.sql#L377)
- Own-row insert/select/update:
  - [supabase/schema.sql](supabase/schema.sql#L380)

Storage integration:
- Private bug-reports bucket with MIME and size controls.
- Per-user folder ownership policies on storage.objects.
- [supabase/schema.sql](supabase/schema.sql#L438)
- [supabase/schema.sql](supabase/schema.sql#L449)

Frontend submission path:
- RPC submit_bug_report call:
  - [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L184)

Post-submit notification path:
- Edge function invocation:
  - [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L209)
- Edge function implementation:
  - [supabase/functions/bug-report-notify/index.ts](supabase/functions/bug-report-notify/index.ts#L1)

---

## 2.3 RLS implementation deep dive (scalar subquery model)

Kosha consistently uses this form across policies:

(select auth.uid()) = owner_column

Representative anchors:
- [supabase/schema.sql](supabase/schema.sql#L221)
- [supabase/schema.sql](supabase/schema.sql#L237)
- [supabase/schema.sql](supabase/schema.sql#L349)

Why scalar subqueries are used:
1. Predictable evaluation shape inside policy expressions.
2. Consistent style across USING and WITH CHECK clauses.
3. Better planner behavior in many Supabase/Postgres RLS workloads versus repeatedly embedding function calls in more complex boolean expressions.
4. Clear auditability: every policy visibly ties to auth.uid ownership semantics.

USING vs WITH CHECK in this schema:
1. USING controls which existing rows are visible or targetable for read/update/delete.
2. WITH CHECK controls which new row values are allowed on insert/update.

Examples:
- Insert ownership check:
  - [supabase/schema.sql](supabase/schema.sql#L241)
- Update ownership guard:
  - [supabase/schema.sql](supabase/schema.sql#L266)

Invite consume policy demonstrates mixed-mode authorization:
1. Creator can update invite rows they created.
2. Non-creator can consume only if row is unclaimed and they set used_by to themselves with used_at present.
- [supabase/schema.sql](supabase/schema.sql#L287)

Storage RLS uses folder-based user partitioning:
- [supabase/schema.sql](supabase/schema.sql#L453)

---

## 2.4 Custom RPC architecture and rationale

The four core RPCs are explicitly documented in schema as performance and safety remediations:
- [supabase/schema.sql](supabase/schema.sql#L611)

## 2.4.1 get_running_balance

Definition:
- [supabase/schema.sql](supabase/schema.sql#L628)

Contract:
1. Input: p_user_id, p_end_date.
2. Output: one numeric scalar.
3. Semantics: sum income as positive and non-income as negative through end date.

Why this design:
1. Replaces client-side full-row scans and JavaScript summation.
2. Returns one number instead of potentially large datasets.
3. Leverages database aggregation directly, reducing network and browser CPU.

Security:
- security invoker, still constrained by table RLS and caller context.
- [supabase/schema.sql](supabase/schema.sql#L635)

Frontend consumers:
- [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L605)
- [src/App.jsx](src/App.jsx#L776)

---

## 2.4.2 get_month_summary

Definition:
- [supabase/schema.sql](supabase/schema.sql#L812)

Contract:
1. Input: p_user_id, p_year, p_month.
2. Output rows grouped by type, is_repayment, category, investment_vehicle with summed total.

Why this design:
1. Pushes group-by work into Postgres.
2. Returns small aggregate rowsets instead of raw transactions.
3. Provides a stable summary contract that frontend parser can normalize.

Frontend parser and call sites:
- Parser: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L15)
- Hook call: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L457)
- Prefetch calls: [src/App.jsx](src/App.jsx#L174) and [src/App.jsx](src/App.jsx#L762)

---

## 2.4.3 get_year_summary

Definition:
- [supabase/schema.sql](supabase/schema.sql#L855)

Contract:
1. Input: p_user_id, p_year.
2. Output single row containing:
   1. monthly_data JSON array.
   2. category_data JSON object.
   3. vehicle_data JSON object.
   4. totals JSON object.
   5. top5_expenses JSON array.

Implementation characteristics:
1. Materializes year slice once into temp table _yr.
2. Derives all aggregates from _yr to avoid repeated base table scans.
3. Returns pre-shaped analytics payloads aligned to charting needs.

Why marked volatile:
- Uses temp table creation inside plpgsql body.
- [supabase/schema.sql](supabase/schema.sql#L868)
- [supabase/schema.sql](supabase/schema.sql#L879)

Frontend normalization and call sites:
- Hook call and normalization:
  - [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L480)
- App prefetch:
  - [src/App.jsx](src/App.jsx#L209)
- Card-level usage:
  - [src/components/cards/analytics/YoYCards.jsx](src/components/cards/analytics/YoYCards.jsx#L21)

---

## 2.4.4 mark_liability_paid

Definition:
- [supabase/schema.sql](supabase/schema.sql#L954)

Contract:
1. Input: liability id and user id.
2. Output: JSON containing transaction_id, liability_id, and optionally next_due_date.

Atomic transaction flow inside function:
1. Lock liability row with for update.
2. Validate existence and unpaid status.
3. Insert linked expense transaction.
4. Mark liability as paid and attach linked transaction id.
5. If recurring, create the next liability row.

Why this design:
1. Fixes split-brain risk from multi-call client workflows.
2. Guarantees all-or-nothing consistency between liability and transaction records.
3. Encapsulates recurring roll-forward logic at database boundary.

Frontend usage:
- Direct RPC invocation:
  - [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L157)

---

## 2.5 Bug report backend RPC and function pipeline

submit_bug_report RPC:
- [supabase/schema.sql](supabase/schema.sql#L472)

Behavior:
1. Auth required through auth.uid guard.
2. Input validation for title, description, severity normalization.
3. Per-user rate limit: maximum 5 reports in 2 minutes.
4. Duplicate detection by fingerprint + route in 7-day window.
5. Duplicate path increments occurrence_count and merges metadata/tags.
6. New path inserts normalized bug record and returns report id.

Edge notification:
- Function reads bug row with service role client.
- Generates signed screenshot URL if present.
- Posts to Discord or Slack-compatible webhook payload.
- Updates notified_at after successful webhook dispatch.
- [supabase/functions/bug-report-notify/index.ts](supabase/functions/bug-report-notify/index.ts#L33)
- [supabase/functions/bug-report-notify/index.ts](supabase/functions/bug-report-notify/index.ts#L87)

---

## 2.6 Backend integrity checklist for incoming engineers

1. When adding a table:
- Mirror the idempotent DDL style used in [supabase/schema.sql](supabase/schema.sql#L1).
- Add FK guards and indexes.
- Enable RLS and define explicit policies for each required operation.

2. When adding an RPC:
- Prefer security invoker unless there is a strict reason for definer.
- Ensure all ownership constraints are validated in SQL body.
- Return payloads shaped for direct frontend consumption to reduce client-side reshaping.

3. When changing ownership logic:
- Keep scalar auth.uid subquery pattern consistent for policy readability and predictability.
- Update both narrow and convenience policy blocks where overlapping policies exist.

4. Current notable schema state:
- public.budgets exists with RLS enabled but no active frontend path.
- category_budgets is the active production budget store.
- Confirm intended deprecation or convergence path before future budgeting feature work.

