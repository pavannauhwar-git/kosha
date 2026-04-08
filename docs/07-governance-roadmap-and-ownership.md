# Chapter 7: Governance, Roadmap, and Long-Term Ownership

## 7.1 End-State Ownership Model

This final chapter defines how Kosha should be operated after handover so feature velocity does not degrade system trust.

The ownership model has three concurrent responsibilities:

1. Keep financial correctness and mutation integrity stable.
2. Evolve product signals intentionally instead of adding redundant UI noise.
3. Ship releases through deterministic verification gates.

Operational anchors:

1. Release process baseline in [README.md](README.md#L310).
2. Contribution and branch policy in [README.md](README.md#L337) and [README.md](README.md#L356).
3. Operational script inventory in [scripts/README.md](scripts/README.md#L5).

---

## 7.2 Source-of-Truth Registry

Use this map to avoid conflicting decisions across docs and code.

| Domain | Primary Source | What It Controls |
|---|---|---|
| Platform and setup | [README.md](README.md#L1) | Environment, setup, deployment, contributor workflow |
| Schema contract | [README.md](README.md#L174) and [supabase/schema.sql](supabase/schema.sql) | Idempotent DB shape, RLS, RPC availability |
| Runtime scripts | [scripts/README.md](scripts/README.md#L5) | Ops/test script intent and QA guidance |
| Release gate sequence | [scripts/ops/release_candidate_check.mjs](scripts/ops/release_candidate_check.mjs#L3) | Ordered release checks and retries |
| Deploy readiness | [scripts/ops/check_deploy_readiness.mjs](scripts/ops/check_deploy_readiness.mjs#L58) | Live schema and RPC contract verification |
| UX and page intent | [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L3) | Page purpose, consistency rules, quality gates |
| Card signal governance | [docs/CARD_SIGNAL_BLUEPRINT.md](docs/CARD_SIGNAL_BLUEPRINT.md#L7) | Focus-vs-deep card boundaries by page |
| Chart governance | [docs/CHART_INVENTORY_ROADMAP.md](docs/CHART_INVENTORY_ROADMAP.md#L5) | Chart type selection, redundancy decisions, roadmap order |
| Release history | [src/lib/changelog.js](src/lib/changelog.js#L1) | Human-readable release narrative and shipped scope |
| Runtime crash telemetry | [src/lib/runtimeMonitor.js](src/lib/runtimeMonitor.js#L64) and [src/components/errors/GlobalErrorBoundary.jsx](src/components/errors/GlobalErrorBoundary.jsx#L8) | Error capture, crash diagnostics, bug-report prefill |

Governance rule:

1. If two artifacts disagree, update the source-of-truth artifact first, then align implementation.

---

## 7.3 Product Signal Governance

Kosha should evolve by improving decision quality, not by increasing visual volume.

## 7.3.1 Card-level governance

Card signal boundaries are defined by page in [docs/CARD_SIGNAL_BLUEPRINT.md](docs/CARD_SIGNAL_BLUEPRINT.md#L7), [docs/CARD_SIGNAL_BLUEPRINT.md](docs/CARD_SIGNAL_BLUEPRINT.md#L21), [docs/CARD_SIGNAL_BLUEPRINT.md](docs/CARD_SIGNAL_BLUEPRINT.md#L34), and [docs/CARD_SIGNAL_BLUEPRINT.md](docs/CARD_SIGNAL_BLUEPRINT.md#L55).

Noise removal policy is explicit in [docs/CARD_SIGNAL_BLUEPRINT.md](docs/CARD_SIGNAL_BLUEPRINT.md#L66):

1. Focus cards must be action-first.
2. Deep cards should stay diagnostic and investigatory.
3. Duplicate signal cards should be merged or removed.

## 7.3.2 Chart-level governance

Chart decisions are locked by matrix and roadmap in [docs/CHART_INVENTORY_ROADMAP.md](docs/CHART_INVENTORY_ROADMAP.md#L15) and [docs/CHART_INVENTORY_ROADMAP.md](docs/CHART_INVENTORY_ROADMAP.md#L62).

Execution rule is codified in [docs/CHART_INVENTORY_ROADMAP.md](docs/CHART_INVENTORY_ROADMAP.md#L115):

1. Every chart must answer a unique decision question.
2. Chart type must be minimal for the question.
3. At least one actionable interpretation must exist.
4. Redundancy flag should remain None or Low after review.

## 7.3.3 Reconciliation signal quality

Reconciliation quality model should be treated as a strategic trust signal, not only a page feature.

Core signal engines:

1. Candidate/queue composition in [src/lib/reconciliation.js](src/lib/reconciliation.js#L46).
2. Confidence drift detection in [src/lib/reconciliationMetrics.js](src/lib/reconciliationMetrics.js#L29).
3. Alias demotion and cooldown quality mechanisms in [src/lib/reconciliationMetrics.js](src/lib/reconciliationMetrics.js#L76) and [src/lib/reconciliationMetrics.js](src/lib/reconciliationMetrics.js#L189).

---

## 7.4 Change Lifecycle: Idea to Production

Use this lifecycle for any non-trivial change.

1. Frame the decision problem.
2. Select governing artifact(s) to update first.
3. Implement code changes in bounded modules.
4. Run required verification scripts.
5. Update release narrative.
6. Ship through release-candidate gate.

Detailed operational contract:

1. Contribution branch and commit policy in [README.md](README.md#L337).
2. Local pre-PR checks in [README.md](README.md#L348).
3. Release-candidate automation in [scripts/ops/release_candidate_check.mjs](scripts/ops/release_candidate_check.mjs#L3).
4. Production smoke/testing guidance in [README.md](README.md#L279).

---

## 7.5 Playbooks by Change Type

## 7.5.1 Schema or RPC changes

1. Apply schema changes idempotently via `supabase/schema.sql`.
2. Re-run deploy readiness to verify tables/columns/RPCs.
3. Re-run reconciliation schema live checks if related.

References:

1. Schema idempotency note in [README.md](README.md#L174).
2. Deploy readiness probes in [scripts/ops/check_deploy_readiness.mjs](scripts/ops/check_deploy_readiness.mjs#L58).
3. Reconciliation schema live check in [scripts/tests/test_reconciliation_schema_live.mjs](scripts/tests/test_reconciliation_schema_live.mjs#L50).

## 7.5.2 Financial mutation flow changes

1. Preserve optimistic update plus rollback contract.
2. Keep audit logging intact for all mutation actions.
3. Run mutation stress and rollback contract checks.

References:

1. Rollback contract assertions in [scripts/tests/test_mutation_rollback_contract.mjs](scripts/tests/test_mutation_rollback_contract.mjs#L24).
2. Stress lifecycle in [scripts/tests/test_mutation_stress.mjs](scripts/tests/test_mutation_stress.mjs#L70).
3. Audit action map in [src/lib/auditLog.js](src/lib/auditLog.js#L3).

## 7.5.3 Dashboard/Monthly/Analytics signal changes

1. Update card blueprint scope if signal class changes.
2. Update chart matrix/roadmap if chart purpose or redundancy status changes.
3. Ensure page still satisfies first-viewport action gate.

References:

1. Card blueprint in [docs/CARD_SIGNAL_BLUEPRINT.md](docs/CARD_SIGNAL_BLUEPRINT.md#L7).
2. Chart roadmap in [docs/CHART_INVENTORY_ROADMAP.md](docs/CHART_INVENTORY_ROADMAP.md#L62).
3. UX quality gates in [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L117).

## 7.5.4 Reconciliation model changes

1. Validate queue and matching behavior end-to-end.
2. Re-check drift and alias-quality outputs.
3. Run reconciliation flow and metrics tests.

References:

1. Reconciliation flow script in [scripts/tests/test_reconciliation_flow.mjs](scripts/tests/test_reconciliation_flow.mjs#L1).
2. Metrics engine in [src/lib/reconciliationMetrics.js](src/lib/reconciliationMetrics.js#L5).

## 7.5.5 Runtime reliability and bug pipeline changes

1. Keep startup runtime monitor wiring intact.
2. Keep global error boundary diagnostics handoff intact.
3. Verify bug submit RPC and notify invocation paths.

References:

1. Monitor startup in [src/main.jsx](src/main.jsx#L9).
2. Boundary diagnostics prefill in [src/components/errors/GlobalErrorBoundary.jsx](src/components/errors/GlobalErrorBoundary.jsx#L26).
3. Bug submission RPC in [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L184).
4. Notification invoke in [src/pages/ReportBug.jsx](src/pages/ReportBug.jsx#L207).

---

## 7.6 Ownership Cadence

Use a fixed cadence to prevent drift.

## 7.6.1 Daily

1. Monitor new bug report entries and crash spikes.
2. Triage release blockers from open regressions.

## 7.6.2 Weekly

1. Review reconciliation quality drift and alias behavior.
2. Review Bills and Loans operational friction from support feedback.
3. Verify roadmap sequence still matches product priorities.

Cadence hints in user-facing guide:

1. Weekly workflow cue in [src/pages/Guide.jsx](src/pages/Guide.jsx#L402).
2. Monthly workflow cue in [src/pages/Guide.jsx](src/pages/Guide.jsx#L403).

## 7.6.3 Monthly

1. Run full release-candidate check on the current mainline.
2. Confirm changelog reflects shipped behavior accurately.
3. Reassess chart/card redundancy decisions.

References:

1. Release candidate pass condition in [scripts/ops/release_candidate_check.mjs](scripts/ops/release_candidate_check.mjs#L96).
2. Changelog registry in [src/lib/changelog.js](src/lib/changelog.js#L1).
3. Chart redundancy section in [docs/CHART_INVENTORY_ROADMAP.md](docs/CHART_INVENTORY_ROADMAP.md#L49).

## 7.6.4 Quarterly

1. Perform architecture cleanup sprint for stale flows and legacy assumptions.
2. Review archived script relevance and remove dead operational paths.

Reference: archived script policy in [scripts/README.md](scripts/README.md#L32).

---

## 7.7 Release Narrative Discipline

Release quality is not complete without narrative traceability.

Changelog discipline:

1. Every shipped release updates [src/lib/changelog.js](src/lib/changelog.js#L1).
2. Keep entries concise and decision-impact oriented.
3. Preserve version chronology and avoid mixing speculative roadmap text into shipped notes.

Current pattern examples:

1. Latest release block in [src/lib/changelog.js](src/lib/changelog.js#L3).
2. Prior release continuity in [src/lib/changelog.js](src/lib/changelog.js#L14).

---

## 7.8 Final Handover Completion Checklist

This checklist marks transfer of ownership from build phase to sustain phase.

1. Environment setup and deployment docs validated against current project.
2. Release-candidate script passes on target branch.
3. Deploy-readiness script passes against target Supabase project.
4. Reconciliation schema and flow checks pass.
5. Production asset integrity check passes for deployed URL.
6. Changelog updated for latest shipped release.
7. Card and chart governance docs aligned with current UI.
8. Crash-report pipeline validated from app to bug report storage and optional webhook.

Primary command anchors:

1. Script catalog in [README.md](README.md#L246).
2. Testing section in [README.md](README.md#L279).
3. Troubleshooting fallbacks in [README.md](README.md#L382).

If all eight items are true, the system is considered handover-complete and sustainably operable.

---

## 7.9 Closing Principle

Kosha should continue to optimize for trust per interaction, not feature count per release.

In practical terms:

1. Correctness before cleverness.
2. Signal quality before dashboard density.
3. Deterministic release checks before deployment speed.
4. Observability before blame.

This principle, combined with Chapters 1-7, is the full operating manual for ongoing ownership.
