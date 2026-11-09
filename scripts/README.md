# Scripts

This folder contains project scripts used for development, verification, release checks, and one-off tools.

## Structure

- `load_env.mjs`: Shared env loader for the live Node scripts. Also refuses to run unless `E2E_EXPECTED_PROJECT_REF` matches `VITE_SUPABASE_URL`.
- `generate_app_icons.py`: PWA icon generator (uses Pillow + Roboto-Black.ttf).
- `ops/`: Operational and release checks.
	- `check_deploy_readiness.mjs`
	- `release_candidate_check.mjs`
- `tests/unit/`: Vitest unit, hook, component, page and schema tests (`npm run test:unit`).
- `tests/`: Node scripts (`test:*` and `lint:*` npm scripts point here).
	- Offline: `test_money_math.mjs`, `test_statement_matching.mjs`, `test_mutation_integration_paths.mjs`, `test_production_asset_integrity.mjs`
	- Live Supabase: `test_join_flow.mjs`, `test_liabilities_realtime.mjs`, `test_mutation_stress.mjs`, `test_reconciliation_flow.mjs`, `test_reconciliation_schema_live.mjs`, `test_rls_partner_isolation.mjs`, `test_splitwise_mutation_paths.mjs`, `test_splitwise_viewer_invite_flow.mjs`

## QA notes

- Browser-extension console noise (for example Grammarly message-channel errors) should be excluded from app QA decisions.
- For clean QA runs: use Incognito with extensions disabled.
- After deploy: unregister service worker once and hard refresh before validating mutation behavior.
