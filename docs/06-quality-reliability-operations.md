# Chapter 6: Quality, Reliability, and Operations Runbook

## 6.1 Reliability posture

Kosha's operations model is designed around safe iteration on financial workflows:

1. Every release is gated by deterministic script checks.
2. Runtime failures are captured with context and routed into structured bug reporting.
3. Critical financial writes emit audit events and retry non-blocking telemetry.
4. Realtime freshness is treated as a reliability enhancer with fallback behavior.

Core runtime and release anchors:

1. Release candidate orchestrator in [scripts/ops/release_candidate_check.mjs](scripts/ops/release_candidate_check.mjs#L1)
2. Deploy readiness probe in [scripts/ops/check_deploy_readiness.mjs](scripts/ops/check_deploy_readiness.mjs#L1)
3. Runtime monitor startup in [src/main.jsx](src/main.jsx#L8)
4. Global crash capture boundary in [src/components/errors/GlobalErrorBoundary.jsx](src/components/errors/GlobalErrorBoundary.jsx#L8)
5. Financial audit logger in [src/lib/auditLog.js](src/lib/auditLog.js#L1)

---

## 6.2 Build and release pipeline

## 6.2.1 NPM entrypoints

The operational command surface is centralized in [package.json](package.json#L6):

1. Build and preview: [package.json](package.json#L8)
2. Release candidate check: [package.json](package.json#L11)
3. Deploy readiness: [package.json](package.json#L12)
4. Domain tests (mutation, reconciliation, join-flow, realtime, production assets): [package.json](package.json#L13)

This creates a single executable release grammar for local and CI usage.

## 6.2.2 Release candidate orchestration

The release orchestrator executes a strict sequence in [scripts/ops/release_candidate_check.mjs](scripts/ops/release_candidate_check.mjs#L3):

1. Build
2. Mutation path checks
3. Reconciliation checks
4. Deploy readiness checks
5. Join and realtime checks
6. Stress checks

Operational behavior:

1. Each step streams output and records duration in [scripts/ops/release_candidate_check.mjs](scripts/ops/release_candidate_check.mjs#L23).
2. Flaky network-sensitive checks can retry (for example join-flow and liabilities-realtime) in [scripts/ops/release_candidate_check.mjs](scripts/ops/release_candidate_check.mjs#L14).
3. Execution halts at first failure and emits a summary table in [scripts/ops/release_candidate_check.mjs](scripts/ops/release_candidate_check.mjs#L89).

## 6.2.3 Deploy readiness guard

Deploy readiness is a schema and RPC contract probe in [scripts/ops/check_deploy_readiness.mjs](scripts/ops/check_deploy_readiness.mjs#L1).

It verifies:

1. Table accessibility and required columns for transactions/liabilities in [scripts/ops/check_deploy_readiness.mjs](scripts/ops/check_deploy_readiness.mjs#L60).
2. Financial events and reconciliation review schema availability in [scripts/ops/check_deploy_readiness.mjs](scripts/ops/check_deploy_readiness.mjs#L89).
3. mark_liability_paid and generate_recurring_transactions RPC availability in [scripts/ops/check_deploy_readiness.mjs](scripts/ops/check_deploy_readiness.mjs#L105).

Critical feature:

1. Missing RPC/table conditions are surfaced with migration-specific guidance, reducing ambiguous deployment failures.

---

## 6.3 Environment and credential model

## 6.3.1 Script env loading

All Node-based scripts load local env files via [scripts/load_env.mjs](scripts/load_env.mjs#L1):

1. `.env` then `.env.local`
2. Existing process env values are not overridden
3. Quoted values are normalized

This keeps script behavior reproducible while supporting local overrides.

## 6.3.2 Required operational env vars

Release and test scripts depend on:

1. Supabase runtime vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) documented in [README.md](README.md#L179).
2. E2E account vars (`E2E_*`) documented in [README.md](README.md#L186).
3. Optional production integrity target (`APP_URL`) in [scripts/tests/test_production_asset_integrity.mjs](scripts/tests/test_production_asset_integrity.mjs#L1).

## 6.3.3 Edge function secrets

Bug-notify function requires:

1. `SUPABASE_URL`
2. `SUPABASE_SERVICE_ROLE_KEY`
3. `BUG_REPORT_WEBHOOK_URL`

These are consumed in [supabase/functions/bug-report-notify/index.ts](supabase/functions/bug-report-notify/index.ts#L24).

---

## 6.4 Verification suite architecture

Kosha's test suite is scenario-first rather than unit-only. Each script validates a production risk lane.

Script index is documented in [scripts/README.md](scripts/README.md#L1).

## 6.4.1 Contract and safety checks

1. Mutation rollback contract static verification in [scripts/tests/test_mutation_rollback_contract.mjs](scripts/tests/test_mutation_rollback_contract.mjs#L1).
2. Reconciliation schema live check in [scripts/tests/test_reconciliation_schema_live.mjs](scripts/tests/test_reconciliation_schema_live.mjs#L1).
3. Deploy readiness schema/RPC probes in [scripts/ops/check_deploy_readiness.mjs](scripts/ops/check_deploy_readiness.mjs#L58).

Why this matters:

1. These checks fail fast when migrations are missing or rollback guarantees regress.

## 6.4.2 Behavior and workflow checks

1. Join invite lifecycle in [scripts/tests/test_join_flow.mjs](scripts/tests/test_join_flow.mjs#L1).
2. Reconciliation persistence and alias reset behavior in [scripts/tests/test_reconciliation_flow.mjs](scripts/tests/test_reconciliation_flow.mjs#L1).
3. Mutation stress lifecycle for transactions and liabilities in [scripts/tests/test_mutation_stress.mjs](scripts/tests/test_mutation_stress.mjs#L1).

Why this matters:

1. These tests reflect user-facing workflows, not isolated helper behavior.

## 6.4.3 Realtime delivery checks

Realtime reliability is explicitly validated in [scripts/tests/test_liabilities_realtime.mjs](scripts/tests/test_liabilities_realtime.mjs#L1):

1. Dual-session sign-in (actor/listener)
2. Channel subscription handshake
3. Timed insert event delivery
4. Retries across transient channel failures

WebSocket fallback behavior:

1. For Node environments without native WebSocket, `ws` polyfill import is attempted in [scripts/tests/test_liabilities_realtime.mjs](scripts/tests/test_liabilities_realtime.mjs#L20).

## 6.4.4 Production asset integrity checks

Deployed artifact sanity is tested by [scripts/tests/test_production_asset_integrity.mjs](scripts/tests/test_production_asset_integrity.mjs#L1):

1. Fetches deployed HTML
2. Extracts hashed JS/CSS asset URLs
3. Verifies asset fetch and content-type correctness
4. Emits manual post-deploy service-worker hygiene step

This complements build success by validating deployment output, not only local dist generation.

---

## 6.5 Runtime resilience architecture

## 6.5.1 Startup monitoring

Runtime monitor starts before React render in [src/main.jsx](src/main.jsx#L8).

It captures:

1. Window script errors
2. Unhandled promise rejections
3. Recent route trail and event buffers

Implementation in [src/lib/runtimeMonitor.js](src/lib/runtimeMonitor.js#L1) stores bounded diagnostics in sessionStorage.

## 6.5.2 Global crash handling

Rendering crashes are trapped by GlobalErrorBoundary in [src/components/errors/GlobalErrorBoundary.jsx](src/components/errors/GlobalErrorBoundary.jsx#L8).

Behavior:

1. Displays recovery UI with reload/home/report options.
2. Prepares structured runtime prefill payload for bug report flow in [src/components/errors/GlobalErrorBoundary.jsx](src/components/errors/GlobalErrorBoundary.jsx#L26).
3. Navigates directly to Report Bug with crash context.

## 6.5.3 Query performance tracing

Query timing trace utility exists in [src/lib/queryTrace.js](src/lib/queryTrace.js#L1).

Key properties:

1. Dev-only activation by localStorage flag.
2. Zero overhead when disabled.
3. Consistent timing logs for network/query bottleneck diagnosis.

## 6.5.4 Realtime fallback behavior

GlobalRealtimeSync in [src/App.jsx](src/App.jsx#L535) provides resilient freshness behavior:

1. Subscribes to table change events.
2. Applies delayed family invalidation.
3. Falls back to polling when socket becomes unavailable.
4. Reconnects with progressive retry delays.

This prevents hard dependency on websocket continuity.

---

## 6.6 Auditability and financial event logging

Financial mutation telemetry is implemented in [src/lib/auditLog.js](src/lib/auditLog.js#L1).

### Action taxonomy

Standardized action types include:

1. Transaction add/update/delete
2. Liability add/mark-paid/delete
3. Loan add/payment/delete

Defined in [src/lib/auditLog.js](src/lib/auditLog.js#L3).

### Delivery semantics

1. Logger retries failed inserts with bounded exponential-like delay in [src/lib/auditLog.js](src/lib/auditLog.js#L16).
2. Missing `financial_events` table is treated as safe no-op for partially migrated environments in [src/lib/auditLog.js](src/lib/auditLog.js#L39).
3. Final failures are warning-logged and do not block user mutations.

Operational implication:

1. Business mutations stay available even when telemetry path degrades.
2. Audit trail remains best-effort durable under transient backend errors.

---

## 6.7 Bug intake and triage pipeline

Kosha has an end-to-end in-app bug pipeline from crash to webhook notification.

## 6.7.1 Client-side report creation

ReportBug page entry is in [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L24).

Capabilities:

1. Structured title/description/steps/severity/tags input.
2. Optional screenshot compression and upload in [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L111).
3. Fingerprint and diagnostics packaging via utility helpers from [src/lib/bugReportUtils.js](src/lib/bugReportUtils.js#L1).

Submission path:

1. RPC `submit_bug_report` call in [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L184).
2. Optional edge notification invoke in [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L207).

## 6.7.2 Bug utility helpers

Utility module [src/lib/bugReportUtils.js](src/lib/bugReportUtils.js#L1) provides:

1. Stable fingerprint generation for dedupe in [src/lib/bugReportUtils.js](src/lib/bugReportUtils.js#L5).
2. Tag normalization with strict character policy in [src/lib/bugReportUtils.js](src/lib/bugReportUtils.js#L22).
3. Client-side image compression for large screenshot payloads in [src/lib/bugReportUtils.js](src/lib/bugReportUtils.js#L41).

## 6.7.3 Edge notification bridge

Edge function implementation in [supabase/functions/bug-report-notify/index.ts](supabase/functions/bug-report-notify/index.ts#L1):

1. Loads bug report via service-role client.
2. Generates signed screenshot URL when available.
3. Posts to configured webhook (Discord-compatible or generic JSON).
4. Marks report `notified_at` on success.

This separates user-report persistence from external notification reliability.

---

## 6.8 Deployment and hosting behavior

## 6.8.1 SPA rewrite contract

Hosting rewrite behavior is defined in [vercel.json](vercel.json#L1):

1. Filesystem handler first
2. Fallback route rewrite to `index.html` for non-file paths

This is required for client-side routed pages like `/reconciliation` and `/report-bug`.

## 6.8.2 Build-time hardening

Vite configuration in [vite.config.js](vite.config.js#L1) enforces:

1. Console/debugger stripping via esbuild drop in [vite.config.js](vite.config.js#L35).
2. Deterministic vendor chunk splitting in [vite.config.js](vite.config.js#L5).
3. PWA runtime caching policy for Supabase REST and font assets in [vite.config.js](vite.config.js#L67).

Operational meaning:

1. Smaller, cache-friendly bundles.
2. Offline-capable repeat visits.
3. Controlled stale-while-revalidate data behavior aligned with query-layer freshness.

---

## 6.9 Release and incident runbook

## 6.9.1 Pre-release checklist

1. Ensure env vars are present and valid.
2. Run full build and release candidate checks.
3. Confirm deploy-readiness pass against target Supabase project.
4. Validate production assets after deploy.

Commands:

1. `npm run build`
2. `npm run test:deploy-readiness`
3. `npm run release:candidate-check`
4. `npm run test:production-assets`

Entrypoint references:

1. [README.md](README.md#L285)
2. [scripts/ops/release_candidate_check.mjs](scripts/ops/release_candidate_check.mjs#L1)

## 6.9.2 If release-candidate check fails

1. Stop promotion immediately.
2. Identify first failed stage from release summary output.
3. Re-run only failed check locally after fix.
4. Re-run full release candidate suite before shipping.

The orchestrator intentionally fails-fast in [scripts/ops/release_candidate_check.mjs](scripts/ops/release_candidate_check.mjs#L75), so first failure is usually the most actionable signal.

## 6.9.3 If realtime checks fail intermittently

1. Re-run liabilities realtime script (it has internal retries).
2. Verify websocket availability (`ws` fallback path for Node).
3. Validate Supabase realtime configuration and network constraints.

Reference: [scripts/tests/test_liabilities_realtime.mjs](scripts/tests/test_liabilities_realtime.mjs#L20).

## 6.9.4 If reconciliation schema checks fail

1. Apply latest `supabase/schema.sql`.
2. Re-run reconciliation schema live check.
3. Re-run deploy readiness script.

References:

1. [scripts/tests/test_reconciliation_schema_live.mjs](scripts/tests/test_reconciliation_schema_live.mjs#L50)
2. [scripts/ops/check_deploy_readiness.mjs](scripts/ops/check_deploy_readiness.mjs#L97)

## 6.9.5 If runtime crash reports spike

1. Inspect bug_reports entries and occurrence_count trends.
2. Use captured route + runtime diagnostics payload from bug reports.
3. Correlate with recent release changes and query timings (if trace enabled).
4. Patch and verify via focused scenario scripts before broad release.

---

## 6.10 Operational guardrails for contributors

1. Never ship schema-dependent changes without running deploy-readiness checks.
2. Keep mutation rollback guarantees intact when refactoring hook mutation wrappers.
3. Preserve bug report fields and fingerprint behavior to avoid triage regressions.
4. Treat release-candidate check as mandatory, not optional.
5. Keep realtime and fallback paths functional; test both optimistic and eventual-consistency behavior.
6. Do not bypass runtime error boundary or monitor wiring in app bootstrap.

Adhering to these guardrails keeps Kosha financially trustworthy under both normal and failure conditions.
