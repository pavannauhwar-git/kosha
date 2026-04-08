# Chapter 5: Feature Module Architecture and Workflow Contracts

## 5.1 Why this chapter exists

Chapters 1-4 defined platform, database, data engine, and UI system. This chapter defines the application module map: which page owns which business workflow, where side effects originate, and how cross-page integrity is preserved.

At runtime, feature modules are route-bounded and coordinated through shared hooks and invalidation families.

Route entrypoints:

1. Dashboard route in [src/App.jsx](src/App.jsx#L818)
2. Transactions route in [src/App.jsx](src/App.jsx#L819)
3. Monthly route in [src/App.jsx](src/App.jsx#L820)
4. Analytics route in [src/App.jsx](src/App.jsx#L821)
5. Bills route in [src/App.jsx](src/App.jsx#L822)
6. Loans route in [src/App.jsx](src/App.jsx#L823)
7. Reconciliation route in [src/App.jsx](src/App.jsx#L824)
8. Guide route in [src/App.jsx](src/App.jsx#L825)
9. Settings route in [src/App.jsx](src/App.jsx#L826)
10. Report Bug route in [src/App.jsx](src/App.jsx#L828)

Global cross-domain freshness contract:

1. Realtime invalidation families are declared in [src/App.jsx](src/App.jsx#L85).
2. The families map directly to transactions, liabilities, and loans domains in [src/App.jsx](src/App.jsx#L86).
3. Invalidation execution is centralized in GlobalRealtimeSync in [src/App.jsx](src/App.jsx#L535).

---

## 5.2 Feature module map

| Module | Primary Route | Core Hook Surface | Primary Responsibility |
|---|---|---|---|
| Dashboard | / | useRecentTransactions, useMonthSummary, useRunningBalance | Daily command center and action routing |
| Transactions | /transactions | useTransactions + save/remove mutations | Canonical ledger editing and export |
| Bills | /bills | useLiabilities + liability mutations | Obligation tracking and paid-state conversion |
| Loans | /loans | useLoans + loan mutations | Personal credit/debit lifecycle tracking |
| Reconciliation | /reconciliation | useReconciliationReviews + useTransactions | Data-quality QA and statement linking |
| Monthly | /monthly | useMonthSummary, useLiabilitiesByMonth, useBudgets | Month-close performance and planning |
| Analytics | /analytics | useYearSummary, useYearDailyExpenseTotals | Strategic yearly intelligence |
| Guide | /guide | local feature-card model | Product adoption and workflow coaching |
| Settings | /settings | useAuth + reminders utilities | Identity, reminders, profile controls |
| Report Bug | /report-bug | submit_bug_report RPC + edge notify | Structured operational feedback |

---

## 5.3 Dashboard module (daily command center)

Module anchor: [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L223)

### Inputs

Dashboard composes multiple data surfaces:

1. Recent ledger stream through [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L294).
2. Current month aggregate through [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L301).
3. Running balance horizon through [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L310).
4. Cross-domain sheet action bridge via AddTransactionSheet in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L1175).

### Behavioral contract

1. The hero is treated as critical-first content and blocks on summary + balance load in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L318).
2. Background refreshes never tear primary layout; they are signaled as non-blocking sync text in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L319) and [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L816).
3. Heavy secondary surfaces are intentionally delayed for first-paint stability.

### UX responsibility

Dashboard is a routing origin, not a deep editor. It exposes directional nudges and routes users to specialized modules for precision operations.

Signals and advanced surfaces:

1. Dashboard nudges in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L841).
2. Daily variance/bubble heatmap in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L859).
3. Cash risk radar surface in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L886).

---

## 5.4 Transactions module (source-of-truth editor)

Module anchor: [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L52)

### Inputs and filtering pipeline

1. Primary ledger query with type/category/search/date/limit filters in [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L126).
2. Filter chips and date presets are UI projections of query arguments in [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L429) and [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L449).
3. Route-focus deep links are resolved by focus param and scroll-to logic.

### Editing and mutation flow

1. Transaction edits and creates are routed through AddTransactionSheet in [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L618).
2. Delete flow delegates to removeTransactionMutation via handleDelete in [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L206).
3. Quick add entrypoints exist in both top action cluster and FAB in [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L372) and [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L614).

### Operational exports

1. Filter-aware CSV export is implemented by exportCSV in [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L230).

### Domain rule

Transactions is the canonical record editor. Other modules may create derived transaction side effects, but this page remains the precision correction surface.

---

## 5.5 Bills module (obligation lifecycle)

Module anchor: [src/pages/Bills.jsx](src/pages/Bills.jsx#L29)

### Inputs and state partitioning

1. Bills consumes pending and paid sets from useLiabilities in [src/pages/Bills.jsx](src/pages/Bills.jsx#L33).
2. UI tab state is URL-aware and supports query-driven landing in [src/pages/Bills.jsx](src/pages/Bills.jsx#L32) and [src/pages/Bills.jsx](src/pages/Bills.jsx#L101).
3. Pending items are enriched into overdue/dueSoon/later buckets in [src/pages/Bills.jsx](src/pages/Bills.jsx#L71).

### Core workflows

1. Add bill via addLiabilityMutation in [src/pages/Bills.jsx](src/pages/Bills.jsx#L196).
2. Mark paid via markLiabilityPaidMutation in [src/pages/Bills.jsx](src/pages/Bills.jsx#L212).
3. Delete via deleteLiabilityMutation in [src/pages/Bills.jsx](src/pages/Bills.jsx#L229).

### Integrity behavior

1. Delete uses optimistic hide with rollback-on-failure semantics in [src/pages/Bills.jsx](src/pages/Bills.jsx#L223).
2. Pending card interactions disable appropriately while pay/delete is in flight.
3. Paid history and pending queue are intentionally separated to prevent accidental operational mixing.

### Planning overlays

1. Due-soon amount/count and urgency bar are computed in [src/pages/Bills.jsx](src/pages/Bills.jsx#L52) and [src/pages/Bills.jsx](src/pages/Bills.jsx#L86).
2. Paid-side intelligence is surfaced via BillPaymentInsights in [src/pages/Bills.jsx](src/pages/Bills.jsx#L399).

### Sheet workflow contract

The add-bill sheet includes recurrence semantics and due date normalization in [src/pages/Bills.jsx](src/pages/Bills.jsx#L509).

---

## 5.6 Loans module (credit and settlement lifecycle)

Module anchor: [src/pages/Loans.jsx](src/pages/Loans.jsx#L27)

### Inputs and segmentation

1. Loans consumes three streams (given, taken, settled) through useLoans.
2. UI tab partition is directional, not chronological, so risk and receivable views remain explicit.

### Core workflows

1. Add loan via addLoanMutation in [src/pages/Loans.jsx](src/pages/Loans.jsx#L93).
2. Partial payment via recordLoanPaymentMutation in [src/pages/Loans.jsx](src/pages/Loans.jsx#L115).
3. Full settlement shortcut via recordLoanPaymentMutation with remaining amount in [src/pages/Loans.jsx](src/pages/Loans.jsx#L130).
4. Delete via deleteLoanMutation in [src/pages/Loans.jsx](src/pages/Loans.jsx#L142).

### Domain mechanics

1. Progress visualization uses loanProgress and settled-vs-principal in card rendering.
2. Interest accrual is displayed as contextual decision support.
3. Payment sheet constrains valid amount and offers quick fills in [src/pages/Loans.jsx](src/pages/Loans.jsx#L420).

### Integrity behavior

1. Optimistic rows are visibly marked as syncing.
2. Action controls are disabled while delete/payment operations are active.

---

## 5.7 Reconciliation module (data-quality QA engine)

Module anchor: [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L86)

### Inputs and fallback design

1. Reconciliation draws transaction candidates from useTransactions in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L99).
2. Review states come from useReconciliationReviews in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L109).
3. If review table is unavailable, local reviewed state fallback is used in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L113).

### Tabbed architecture

Reconciliation is already organized into three functional tabs:

1. Queue tab: unresolved and QA-driven fixes.
2. Matching tab: statement-line parsing and alias learning.
3. Overview tab: funnel and turnaround metrics.

Tabs are defined in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L476) and rendered from [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L527).

### Queue workflows

1. Quality filters and review-state filters operate as staged triage in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L550).
2. Category correction path uses saveTransactionMutation and then persists review state in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L443).
3. Mark-reviewed flow persists structured review rows in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L417).

### Matching workflows

1. Statement input parsing and match generation are built from parseStatementLines and matchStatementEntries.
2. Link decision uses upsertReconciliationReview with linked status in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L390).
3. False-positive feedback loop uses reportReconciliationFalsePositive in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L429).
4. Alias reset capability is available through clearLearnedReconciliationAliases in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L462).

### Metrics and governance

1. Funnel and linked conversion are built in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L251).
2. Turnaround distribution and median resolution are computed from review history in [src/pages/Reconciliation.jsx](src/pages/Reconciliation.jsx#L271).

Reconciliation therefore functions as a reliability layer for every insight module, not merely a helper screen.

---

## 5.8 Analytics and Monthly modules (decision surfaces)

## 5.8.1 Analytics module

Module anchor: [src/pages/Analytics.jsx](src/pages/Analytics.jsx#L87)

Responsibilities:

1. Year-level strategic reporting from useYearSummary and daily totals in [src/pages/Analytics.jsx](src/pages/Analytics.jsx#L98).
2. Multi-chart synthesis (cashflow, composition, runway, pareto, simulator).
3. Scenario and recommendation framing from normalized yearly data.

Behavioral notes:

1. Heavy secondary analysis is delayed for smoother entry rendering.
2. Empty-year state routes users back to data capture if no signal exists.

## 5.8.2 Monthly module

Primary role: month-close control plane integrating summary, liabilities, budgets, reconciliation queue, and trend surfaces.

Core anchor points:

1. Module entry in [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L30).
2. Month summary source in [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L42).
3. Month-scoped transaction and liabilities reads in [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L45) and [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L52).
4. Budget integration in [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L53).

Monthly is where operational flows (transactions/bills/reconciliation) are converted into period-close judgments.

---

## 5.9 Cross-module workflow chains

These are the most important end-to-end contracts in the system.

## 5.9.1 Bill payment chain

1. User marks pending bill as paid in Bills page.
2. Bills page calls markLiabilityPaidMutation in [src/pages/Bills.jsx](src/pages/Bills.jsx#L212).
3. Hook layer updates liabilities caches and related transaction surfaces through cross-family invalidation.
4. Dashboard, Monthly, and Analytics surfaces consume the refreshed totals and due-state posture.

## 5.9.2 Loan payment chain

1. User records payment from Loans page in [src/pages/Loans.jsx](src/pages/Loans.jsx#L115).
2. recordLoanPaymentMutation updates loan progress and injects corresponding transaction-side effects.
3. Transactional surfaces and summaries converge without waiting for a full manual refresh.

## 5.9.3 Reconciliation correction chain

1. User sets missing category from Queue card in Reconciliation.
2. saveTransactionMutation runs and persists ledger correction.
3. Reconciliation review is persisted in the same interaction path.
4. Downstream insights and dashboards consume corrected categorization.

## 5.9.4 Global freshness chain

1. Domain writes suppress duplicate immediate realtime refetches.
2. Realtime listener invalidates transaction/liability/loan families via centralized policies in [src/App.jsx](src/App.jsx#L85).
3. UI remains stable while eventually converging to server truth.

---

## 5.10 Support modules that complete the product loop

## 5.10.1 Guide module

Guide codifies adoption and operating cadence, not just documentation text.

Key structures:

1. Feature card registry in [src/pages/Guide.jsx](src/pages/Guide.jsx#L56).
2. Loans card presence in [src/pages/Guide.jsx](src/pages/Guide.jsx#L178).
3. Cadence framing and next-feature progression in [src/pages/Guide.jsx](src/pages/Guide.jsx#L239).

## 5.10.2 Settings module

Settings governs profile and reminder configuration.

Key structures:

1. Module entry in [src/pages/Settings.jsx](src/pages/Settings.jsx#L53).
2. Reminder preferences load/save and toggles in [src/pages/Settings.jsx](src/pages/Settings.jsx#L61) and [src/pages/Settings.jsx](src/pages/Settings.jsx#L149).
3. Notification permission flow in [src/pages/Settings.jsx](src/pages/Settings.jsx#L152).

## 5.10.3 Report Bug module

Report Bug closes the reliability loop by capturing structured defect telemetry.

Key structures:

1. Module entry in [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L24).
2. Screenshot upload pipeline in [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L111).
3. submit_bug_report RPC invocation in [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L184).
4. Edge notification invoke in [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L207).

---

## 5.11 Extension guide for new feature modules

When adding a new module, keep these contracts:

1. Assign a clear route boundary and keep module purpose singular.
2. Reuse existing hook families where possible before introducing new ones.
3. Define optimistic behavior and rollback boundaries before implementing UI actions.
4. Ensure downstream modules that depend on the data family are covered by invalidation policy.
5. Add guidance representation in Guide when the module changes user operating behavior.
6. Add telemetry/bug-report context fields if the module introduces novel failure modes.

This preserves Kosha's current architectural posture: specialized page workflows over a shared, integrity-first data substrate.
