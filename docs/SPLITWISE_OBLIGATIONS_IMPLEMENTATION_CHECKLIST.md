# Splitwise + Obligations Implementation Checklist (Safe Rollout)

Owner: engineering
Date: 2026-04-13
Goal: add Splitwise and merge Bills+Loans UI into Obligations with zero breaking changes.

## Guardrails

- Do not drop or rename existing tables, columns, routes, query keys, or RPC functions.
- Keep existing pages functional via redirects:
  - `/bills` -> `/obligations?tab=bills`
  - `/loans` -> `/obligations?tab=loans`
- Keep existing deep-link query params from Loans flow operational.
- All schema changes must be additive and idempotent.
- All feature changes must be testable in isolation before next phase.

## Phase 0: Baseline (must pass before code changes)

- [ ] Run `npm run build`
- [ ] Run `npm run test:deploy-readiness`
- [ ] Run `npm run release:candidate-check`
- [ ] Capture output and note failures before proceeding.

## Phase 1: Additive Schema Only

- [ ] Add Splitwise tables (additive only):
  - groups
  - group_members
  - group_expenses
  - group_expense_splits
  - group_settlements
- [ ] Add indexes and RLS policies.
- [ ] Add realtime publication entries.
- [ ] Add RPCs for expense write/update/delete, balances, simplification, settle-up.
- [ ] Ensure idempotent migration style (`if not exists`, guarded constraints/policies).

Validation:

- [ ] Existing `loans`, `liabilities`, `transactions` behavior unchanged.
- [ ] No lint/build break from schema file edits.

## Phase 2: Hooks and Cache Wiring

- [ ] Add `useSplitwise` hook module for query + mutation flows.
- [ ] Add `SPLITWISE_INVALIDATION_KEYS` and integrate in realtime invalidation policies.
- [ ] Extend mutation suppression keys to include splitwise tables.
- [ ] Add audit log event actions for splitwise mutations.

Validation:

- [ ] Build passes.
- [ ] No regression in existing hooks (`useLoans`, `useLiabilities`, `useTransactions`).

## Phase 3: Obligations Route (UI Merge, No Data Merge)

- [ ] Add `/obligations` page as a shell with Bills/Loans tabs.
- [ ] Reuse existing Bills and Loans rendering logic/components.
- [ ] Add route redirects from old pages preserving behavior.
- [ ] Keep navigation count stable.

Validation:

- [ ] `/bills` links still open Bills tab in Obligations.
- [ ] `/loans` links still open Loans tab in Obligations.
- [ ] Loan deep-link query behavior still resolves target loan.

## Phase 4: Splitwise UI

- [ ] Add `/splitwise` page.
- [ ] Group selector + member listing.
- [ ] Add expense sheet (equal/exact/percent/shares).
- [ ] Balance cards and simplified settlement suggestions.
- [ ] Settle-up action flow.

Validation:

- [ ] Build passes.
- [ ] Existing pages remain functional.
- [ ] Manual sanity on desktop and mobile.

## Phase 5: Regression and Release

- [ ] Run existing regression scripts:
  - `npm run test:mutation-paths`
  - `npm run test:mutation-integration`
  - `npm run test:mutation-rollback`
  - `npm run test:liabilities-realtime`
  - `npm run test:join-flow`
  - `npm run test:production-assets`
- [ ] Run build and release gates again.

## Rollback

- Frontend rollback: redeploy previous app build.
- Runtime rollback: hide Splitwise route via feature flag if needed.
- DB rollback is not required because migration is additive.
