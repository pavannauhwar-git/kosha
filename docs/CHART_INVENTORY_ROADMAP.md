# Chart Inventory Matrix and 36-Chart Roadmap

Date: 2026-03-31

## Selection Framework (Locked)

1. Use bar or grouped bar for subgroup comparison and rank ordering.
2. Use line for time trend and directional changes.
3. Use scatter or bubble for relationship, clusters, and outliers.
4. Use histogram or box for distribution and spread.
5. Use heatmap only when density over 2 dimensions is the core message.
6. Use pie or donut only for compact part-to-whole snapshots with few segments.
7. Avoid duplicate charts that answer the same decision question at the same granularity.

## Live Chart Inventory Matrix

Redundancy flag scale:
- None: unique decision question or granularity.
- Low: adjacent signal but different analytical purpose.
- Medium: overlaps with another chart and needs guardrails.
- High: should be merged or removed.

| ID | Page | Chart | Decision question | Metric granularity | Chart type | Redundancy flag | Locked action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D-01 | Dashboard | Daily spending habit | Which days in the last 8 weeks had high absolute spend intensity? | Daily x 8 weeks | Heatmap | None | Keep |
| D-02 | Dashboard | Cash Risk Radar | Are next 14-day obligations covered by projected inflow? | Daily projection x 30 days | Dual-line time series | None | Keep |
| D-03 | Dashboard | Spending Drift | Which weekdays are above or below 4-week baseline this week? | Weekday (Mon-Sun), weekly compare | Grouped bar | Low | Keep |
| D-04 | Dashboard | What changed this week | Did spend, income, and net improve vs previous 7 days? | 7-day window compare | Grouped bar | Medium | Keep with strict weekly scope |
| D-05 | Dashboard | Top spend categories this week | Which categories drove this week spend? | Category share, current week | Ranked horizontal bars | Low | Keep |
| M-01 | Monthly | Cashflow Breakdown | How did inflow split into spend, invest, leftover this month? | Month aggregate | Donut ring | Low | Keep |
| M-02 | Monthly | Weekly cashflow cadence | Which weeks drove positive or negative net within the month? | Week buckets inside month | Composed (grouped bars + line) | Medium | Keep |
| M-03 | Monthly | Expense distribution | Is spend concentrated in low-ticket or high-ticket transactions? | Transaction amount distribution, month | Histogram | None | Keep |
| M-04 | Monthly | Category behavior map | Which categories are high-share and high-ticket levers? | Category points, month | Bubble scatter | None | Keep |
| M-05 | Monthly | Portfolio snapshot | What is the current month vehicle mix and deploy rate? | Vehicle share, month | Ranked bars | Medium | Keep with month-only scope |
| M-06 | Monthly | Category spending | Which categories dominated month outflow at a glance? | Category share, month | Treemap | Low | Keep |
| A-01 | Analytics | Year over year trends | How are earned, spent, invested shifting year-over-year? | Yearly multi-series | Multi-line | None | Keep |
| A-02 | Analytics | Cash Flow Pulse | Which months had strongest surplus or deficit pulses? | Monthly bars in selected year | Diverging bar | Medium | Keep |
| A-03 | Analytics | Outflow composition trend | How did expense/invest mix evolve through the year? | Monthly composition | Stacked area + line | Low | Keep |
| A-04 | Analytics | Net movement waterfall | What components explain total annual net movement? | Annual decomposition | Waterfall | Low | Keep |
| A-05 | Analytics | Surplus trajectory | How does cumulative surplus evolve and draw down over year? | Monthly cumulative | Line | Medium | Keep |
| A-06 | Analytics | Runway coverage | How many months of runway exist under stress scenarios? | Scenario months coverage | Scenario bar | None | Keep |
| A-07 | Analytics | Spending vs investment behavior map | Are monthly habits balanced between spend and invest? | Monthly ratio relationship | Bubble scatter | None | Keep |
| A-08 | Analytics | Category Pareto frontier | How many categories explain 80% of annual spend? | Ordered category contribution | Composed (bar + cumulative line) | Low | Keep |
| A-09 | Analytics | Surplus control chart | Which months are statistically outside normal surplus regime? | Monthly net vs control bands | Control line + reference bands | Medium | Keep |
| A-10 | Analytics | Financial habit profile | What is the composite quality of spend, invest, and surplus behavior? | Multi-metric scorecard | Radar | None | Keep |
| A-11 | Analytics | Concentration risk trend | Is expense concentration risk rising through the year? | Monthly top-3 share | Line + threshold | Low | Keep |
| A-12 | Analytics | Yearly portfolio snapshot | Is annual investment mix too concentrated? | Vehicle share, annual | Ranked bars | Medium | Keep with annual-only scope |

## Redundancy Decisions (Locked)

1. Dashboard and Monthly both keep weekly comparison charts, but scopes are fixed:
   - Dashboard: rolling last 7 days vs previous 7 days.
   - Monthly: week buckets within selected month.
2. Allocation views are split by horizon:
   - Monthly: current month deployment and mix.
   - Analytics: yearly concentration and diversification.
3. Surplus overlap is intentional but bounded:
   - A-02 pulse for month-level amplitude.
   - A-05 cumulative path for drawdown narrative.
   - A-09 control chart for statistical outlier detection.

## Final 36-Chart Roadmap (Priority Order)

Status values:
- Live: already implemented.
- Next: build in next 1-2 sprints.
- Planned: build after data prerequisites.

| Rank | Page | Chart | Decision question | Metric granularity | Chart type | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Dashboard | Daily spending habit | Which recent days were hot-spend days? | Daily x 8 weeks | Heatmap | Live |
| 2 | Dashboard | Spending Drift | Which weekdays are above baseline this week? | Weekday vs 4-week baseline | Grouped bar | Live |
| 3 | Dashboard | What changed this week | Is weekly spend/income/net improving? | Rolling 7d vs prior 7d | Grouped bar | Live |
| 4 | Dashboard | Cash Risk Radar | Can upcoming dues be covered? | Daily projection x 30 days | Dual-line | Live |
| 5 | Monthly | Weekly cashflow cadence | Which week in month caused net drift? | Week buckets in month | Composed | Live |
| 6 | Monthly | Expense distribution | Are we high-ticket heavy this month? | Txn amount distribution | Histogram | Live |
| 7 | Monthly | Category behavior map | Which category levers are highest impact? | Category share vs avg ticket | Bubble scatter | Live |
| 8 | Monthly | Category spending | Which categories dominate this month? | Category share | Treemap | Live |
| 9 | Analytics | Year over year trends | How are core annual metrics changing? | Yearly | Multi-line | Live |
| 10 | Analytics | Spending vs investment behavior map | Are monthly habits balanced over the year? | Monthly ratios | Bubble scatter | Live |
| 11 | Analytics | Surplus control chart | Which months are statistically abnormal? | Monthly net regime | Control line | Live |
| 12 | Analytics | Category Pareto frontier | How many categories explain 80% spend? | Ordered annual categories | Composed | Live |
| 13 | Analytics | Financial habit profile | What is the composite behavioral score? | Multi-metric annual score | Radar | Live |
| 14 | Analytics | Concentration risk trend | Is concentration risk rising? | Monthly top-3 share | Line + threshold | Live |
| 15 | Analytics | Runway coverage scenarios | What runway exists under stress? | Scenario-level annual | Scenario bar | Live |
| 16 | Analytics | Cash flow pulse | Which months show strongest deficits/surplus? | Monthly | Diverging bar | Live |
| 17 | Analytics | Outflow composition trend | How does outflow mix evolve? | Monthly | Stacked area + line | Live |
| 18 | Analytics | Net movement waterfall | What explains annual net movement? | Annual decomposition | Waterfall | Live |
| 19 | Analytics | Surplus trajectory | How does cumulative surplus behave? | Monthly cumulative | Line | Live |
| 20 | Monthly | Cashflow breakdown | How does month inflow split? | Monthly aggregate | Donut ring | Live |
| 21 | Monthly | Portfolio snapshot | Is monthly deploy rate healthy? | Vehicle mix in month | Ranked bars | Live |
| 22 | Dashboard | Top spend categories this week | Which categories drove this week spend? | Weekly category share | Ranked bars | Live |
| 23 | Dashboard | Intraday spend clock | Which hours drive discretionary spend spikes? | Hourly (if timestamp available) | Circular heatmap | Next |
| 24 | Dashboard | Rolling net control chart | Is daily net entering unstable regime? | Daily net x 30 days | Control line | Next |
| 25 | Dashboard | Weekday spend spread | Which weekdays have widest variability? | Weekday distribution x 8 weeks | Box plot | Next |
| 26 | Dashboard | Due pipeline conversion | Where are bills dropping off in lifecycle? | Due, paid, overdue stages | Grouped bar | Next |
| 27 | Transactions | Transaction amount profile | Are current filters skewed to high tickets? | Filtered transaction amounts | Histogram | Next |
| 28 | Transactions | Category Pareto in ledger | Which categories dominate filtered ledger view? | Filtered category totals | Pareto bar+line | Next |
| 29 | Transactions | Recurring vs ad-hoc flow | Is recurring cashflow ratio healthy? | Monthly split by type | Stacked bar | Next |
| 30 | Transactions | Duplicate and anomaly map | Which entries look suspicious or duplicated? | Amount vs time gap | Scatter | Planned |
| 31 | Monthly | Fixed vs variable trend | Is fixed-cost share creeping up in month? | Week-over-week month split | Stacked area | Planned |
| 32 | Monthly | Merchant concentration frontier | Are too few merchants driving spend? | Merchant contribution in month | Pareto bar+line | Planned |
| 33 | Monthly | Payment mode effectiveness | Which payment modes are driving high-ticket outflow? | Mode x avg ticket/count | Grouped bar | Planned |
| 34 | Analytics | Multi-year surplus spread | How does monthly surplus distribution shift across years? | Monthly net by year groups | Box plot | Planned |
| 35 | Analytics | Income-expense coupling | Are income and expense strongly coupled? | Monthly pairs across years | Scatter + trendline | Planned |
| 36 | Analytics | Vehicle risk-return map | Which vehicles combine growth and consistency best? | Vehicle-level return proxy vs volatility | Bubble scatter | Planned |

## Data Prerequisites and Fallbacks

1. Intraday spend clock (Rank 23) requires reliable transaction time; fallback is daypart buckets based on entry timestamp.
2. Duplicate/anomaly map (Rank 30) requires normalized merchant key and stable transaction IDs; fallback is amount-date proximity clustering.
3. Payment mode effectiveness (Rank 33) requires payment mode field; fallback is source account or category proxy.
4. Vehicle risk-return map (Rank 36) requires recurring valuation or proxy return model; fallback is contribution consistency vs deployment volatility.

## Execution Rule

No new chart enters production unless it passes all checks:

1. Clear decision question not already answered by an existing chart at the same granularity.
2. Chart type is the simplest valid type for the question.
3. At least one action sentence is generated from the chart output.
4. Redundancy flag remains None or Low after release review.
