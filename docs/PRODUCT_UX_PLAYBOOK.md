# Kosha Product and UX Playbook

## Product Intent
Kosha should help users:
1. Capture transactions and liabilities quickly.
2. Keep records trustworthy with low effort.
3. Convert records into weekly and monthly decisions.
4. Build confidence before month-close.

## Page Purpose Map

### Dashboard
Purpose: Daily command center.
Success signal: User identifies one clear next action in under 5 seconds.
Key blocks:
- Hero balance and near-term cash risk pulse.
- Today focus and action CTAs.
- Weekly change digest.
- Recent activity and financial event feed.

### Transactions
Purpose: Source of truth editor.
Success signal: User can find and fix any entry quickly.
Key blocks:
- Search and filters.
- Grouped ledger with inline actions.
- Add/edit sheet and export.

### Bills
Purpose: Obligation risk control.
Success signal: User sees overdue and near-due items clearly.
Key blocks:
- Pending totals and risk preview.
- Due buckets (overdue, due this week, later).
- Mark paid and delete with explicit progress state.

### Monthly
Purpose: Month performance and cashflow control.
Success signal: User knows if month is on-track and what to correct.
Key blocks:
- Month hero.
- Close projection and quality checkpoints.
- Reconciliation entry point.

### Analytics
Purpose: Strategic trend intelligence (year scope).
Success signal: User can explain yearly movement and concentration risk.
Key blocks:
- Year summary.
- Cashflow and net trend.
- Category and portfolio concentration.
- Reconciliation confidence trend.

### Reconciliation
Purpose: Data quality QA before insights and close.
Success signal: Queue decreases steadily and confidence rises.
Key blocks:
- Queue and quality metrics.
- Statement matching workspace.
- Sticky filter context.
- Queue progress indicator.

### Guide
Purpose: Adoption and behavior coaching.
Success signal: User understands where to do what and why.
Key blocks:
- Feature cards by cadence.
- Mobile-friendly detail modal with next/prev controls.

### Settings / About / Report Bug
Purpose: Account trust, controls, and feedback loops.
Success signal: High trust with low friction support.

## Visual Consistency System

### Card Anatomy
All data cards should follow:
1. Header label row.
2. Primary value row.
3. Supporting context row.
4. Optional actions row.

### Type and Spacing
- Use one metric size per card tier.
- Use tabular numbers for currency and counts.
- Keep 4/8/12/16/24 spacing rhythm.

### Status Semantics
- Green: healthy/completed.
- Amber: caution/attention.
- Red: risk/failure.
- Brand blue: neutral/info/action.

### Interaction Semantics
- Never remove destructive rows before server confirmation.
- Show explicit per-row progress for pending actions.
- Keep toast position and duration consistent app-wide.

## Implementation Checklist

### P0 (Current Sprint)
- [x] Move weekly digest to Dashboard.
- [x] Add Dashboard Today focus card with direct CTAs.
- [x] Add Bills due buckets and cash impact preview.
- [x] Add Reconciliation queue progress and sticky filter context.

### P1 (Next Sprint)
- [ ] Add Transactions quick date presets and bulk mode.
- [ ] Add Monthly close checklist strip.
- [ ] Add Analytics top recommendation block ("So what now?").

### P2 (Follow-up)
- [ ] Add Guide role-based paths (beginner/power).
- [ ] Add onboarding optional bills setup step.
- [ ] Add settings IA polish and data-control section.

## Product Quality Gates
- Every page must answer "Why am I here?" in first viewport.
- Every metric card must point to a related action.
- Weekly data appears only on weekly/daily surfaces.
- Yearly surfaces avoid short-window noise unless explicitly labeled.
