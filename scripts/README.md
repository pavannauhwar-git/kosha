# Scripts

This folder contains project scripts used for development, verification, release checks, and one-off tools.

## Structure

- `load_env.mjs`: Shared env loader for Node-based scripts.
- `generate_app_icons.py`: PWA icon generator (uses Pillow + Roboto-Black.ttf).
- `migrate.py`: CSV-to-Supabase transaction import utility.
- `ops/`: Operational and release checks.
	- `check_deploy_readiness.mjs`
	- `release_candidate_check.mjs`
- `tests/`: Automated validation scripts (all `test:*` npm scripts point here).
	- `test_join_flow.mjs`
	- `test_liabilities_realtime.mjs`
	- `test_mutation_paths.mjs`
	- `test_mutation_integration_paths.mjs`
	- `test_mutation_rollback_contract.mjs`
	- `test_mutation_stress.mjs`
	- `test_production_asset_integrity.mjs`
	- `test_reconciliation_flow.mjs`
	- `test_reconciliation_metrics.mjs`
	- `test_reconciliation_schema_live.mjs`
	- `test_statement_matching.mjs`

## QA notes

- Browser-extension console noise (for example Grammarly message-channel errors) should be excluded from app QA decisions.
- For clean QA runs: use Incognito with extensions disabled.
- After deploy: unregister service worker once and hard refresh before validating mutation behavior.

## Archived scripts

Legacy one-off patch/fix scripts are in `scripts/archive/legacy-patches/`.
They are retained for history/reference and are not part of normal app runtime.
