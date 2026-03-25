# Scripts

This folder contains project scripts used for development, migration, and automated checks.

## Active scripts

- `load_env.mjs`: Loads local environment variables for Node-based scripts.
- `migrate.py`: Data migration helper.
- `generate_icons.py`: Generates icon assets.
- `test_join_flow.mjs`: End-to-end join/invite flow validation.
- `test_liabilities_realtime.mjs`: Realtime liabilities event validation.
- `test_mutation_paths.mjs`: Ensures centralized mutation call paths are used.
- `test_mutation_integration_paths.mjs`: Verifies all screens use centralized mutation actions only.
- `test_mutation_rollback_contract.mjs`: Verifies optimistic + rollback contract in mutation hooks.
- `test_production_asset_integrity.mjs`: Checks production asset URLs/content-types to catch rewrite/MIME regressions.
- `test_reconciliation_schema_live.mjs`: Verifies `reconciliation_reviews` table exists in the live Supabase project.

## QA notes

- Browser-extension console noise (for example Grammarly message-channel errors) should be excluded from app QA decisions.
- For clean QA runs: use Incognito with extensions disabled.
- After deploy: unregister service worker once and hard refresh before validating mutation behavior.

## Archived scripts

Legacy one-off patch/fix scripts were moved to `scripts/archive/legacy-patches/`.
They are retained for history/reference and are not part of normal app runtime.
