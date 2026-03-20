# bug-report-notify

Supabase Edge Function used by Phase 2 bug reporting to send notifications when a bug report is submitted.

## Required Secrets

Set these in your Supabase project before deploying:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BUG_REPORT_WEBHOOK_URL` (Slack or Discord webhook URL)

## Deploy

```bash
supabase functions deploy bug-report-notify
```

## Notes

- If `BUG_REPORT_WEBHOOK_URL` is not set, bug submission still succeeds and notification is skipped.
- Screenshot links are generated as signed URLs (7-day expiry) when an attachment exists.
