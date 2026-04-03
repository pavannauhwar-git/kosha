# Premium Visual Regression Checklist

Date: 2026-04-03

## Goal

Provide a lightweight screenshot checklist for premium QA on key pages:
- Dashboard
- Analytics
- Monthly

## Capture Matrix

Use the same two viewport baselines every pass.

1. Desktop: 1440x900
2. Mobile: 390x844

Recommended naming:

`<page>_<viewport>_<state>.png`

Examples:
- `dashboard_desktop_top.png`
- `analytics_mobile_pareto.png`
- `monthly_desktop_mid.png`

## Required Screenshots

1. Dashboard desktop top
2. Dashboard desktop mid (cash risk + due pipeline)
3. Dashboard mobile top
4. Dashboard mobile mid (weekly digest)
5. Analytics desktop top (annual summary + radar)
6. Analytics desktop mid (pareto + simulator)
7. Analytics mobile top
8. Analytics mobile mid (pareto mobile list)
9. Monthly desktop top (hero + month close)
10. Monthly desktop mid (breakdown + daily trend)
11. Monthly mobile top
12. Monthly mobile mid (category/budget area)

## Pass Criteria

Mark each screenshot pass/fail for the checks below.

### Surface and Borders

1. Primary cards use one shared surface language.
2. Nested mini-panels do not show bright blue outlines.
3. Borders appear subtle and neutral, not dominant.

### Color Semantics

1. Expense/deficit/late states use expense tones.
2. Warning tones are used only for caution proximity (for example due soon).
3. Brand tones are used for active UI and informational states.

### Motion and Microstates

1. Nav active transitions feel consistent between pages.
2. Sheet open/close motion is smooth and uses the same timing feel.
3. No abrupt jumps in card reveal or filter panel animation.

### Layout Rhythm

1. Header, card spacing, and section rhythm are consistent top to bottom.
2. Metric chips and badges do not wrap awkwardly at mobile width.
3. Chart legends and labels remain legible without overlap.

## Quick Defect Log Template

Use this block for each issue found:

- Page:
- Viewport:
- Screenshot:
- Severity: low | medium | high
- Finding:
- Expected:
- Proposed fix:
