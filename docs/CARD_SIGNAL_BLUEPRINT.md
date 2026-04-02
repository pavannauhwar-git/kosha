# Card Signal Blueprint

This document defines each card's role by page and classifies cards as:
- **Focus**: action-first, high-signal cards shown by default
- **Deep**: diagnostics, variance analysis, and investigation cards shown on demand

## Dashboard

### Focus
- **Dashboard hero**: current cash posture and quick net status.
- **Daily spend bubble map (7d/14d)**: recent spend rhythm and anomaly spotting.
- **Weekday spend spread**: practical routine volatility by weekday.
- **Due pipeline conversion**: bill lifecycle and leakage risk.

### Deep
- **Cash risk radar**: short-horizon obligations vs projected inflow.
- **Rolling net control chart**: control-band outlier detection.
- **Spending drift**: current-week behavior vs rolling baseline.
- **Activity feed and deep diagnostics**: context for root-cause tracing.

## Monthly

### Focus
- **Month hero**: current month outcome snapshot.
- **Month close summary**: likely close status and runway cue.
- **Breakdown card**: inflow/outflow/investment balance for the month.

### Deep
- **Weekly cashflow cadence**: week-level inflow/outflow rhythm.
- **Expense distribution**: ticket-size concentration and high-ticket risk.
- **Category behavior map**: category-level behavior shifts.
- **Category spending chart**: ranked category depth for deeper drilldowns.

## Analytics

### Focus
- **Annual summary**: yearly totals and top-level year health.
- **Yearly insights**: strategic narrative and action cues.
- **Yearly portfolio snapshot**: allocation and vehicle concentration.
- **YoY cards**: trend context across years.
- **Cash flow chart**: baseline monthly flow trend.
- **What-if simulator**: planning and decision support.

### Deep
- **Monthly composition area**: layered composition dynamics.
- **Cashflow waterfall**: contribution/depletion structure.
- **Surplus trajectory**: monthly net regime shifts.
- **Runway coverage**: surplus-backed coverage diagnostics.
- **Behavior scatter**: spend vs invest behavioral clusters.
- **Category Pareto frontier**: concentration frontier and 80% coverage.
- **Surplus control chart**: control-band outlier signaling.
- **Habit profile radar**: normalized behavior scoring.
- **Category concentration trend**: top-3 dependency risk through the year.

## Transactions

### Focus
- **Transaction workspace**: loaded-vs-total visibility and net-flow status.
- **Find and filter**: search and narrowing controls for daily workflow.
- **Timeline**: grouped, swipe-enabled transaction execution surface.

### Deep
- **No separate deep mode currently**.
- Investigation depth is achieved via stronger filtering and progressive loading.

## Noise Removal Rules

- Keep only cards with clear action value in Focus mode.
- Move diagnostic and model-heavy cards behind Deep mode.
- Do not duplicate the same signal in multiple visuals.
- Preserve one primary card per decision type: cash health, variance, concentration, and execution.
