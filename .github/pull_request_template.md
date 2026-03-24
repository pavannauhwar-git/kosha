## Summary

Describe what changed and why.

## Scope

- [ ] Transactions
- [ ] Bills
- [ ] Dashboard
- [ ] Auth / Onboarding
- [ ] Supabase schema / RLS / RPC
- [ ] CI / Tooling / Docs

## Risk assessment

- User impact:
- Data impact:
- Rollback plan:

## Verification evidence

Local checks (paste command output snippets or link to logs):

- [ ] `npm run build`
- [ ] `npm run test:deploy-readiness`
- [ ] `npm run test:join-flow`
- [ ] `npm run test:liabilities-realtime`
- [ ] `npm run test:mutation-stress`

If any check was intentionally skipped, explain why:

## Database / migration notes

- [ ] No schema change
- [ ] Schema changed and migration SQL included
- [ ] Backward compatibility considered

Details:

## Screenshots / recordings (if UI changed)

Add before/after screenshots or a short recording.

## Release notes

- [ ] Updated `src/lib/changelog.js`
- [ ] Updated `README.md` if setup, env vars, scripts, or release process changed

## Reviewer checklist

- [ ] Problem statement is clear
- [ ] Risks and rollback path are documented
- [ ] Verification evidence is present
- [ ] Follow-up tasks are identified (if any)
