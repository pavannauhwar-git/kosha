import {
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { C } from '../../lib/colors'

function ReconciliationFunnelTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="mini-panel p-3 shadow-card">
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.name || 'Stage'}</p>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-ink-3">Transactions</span>
        <span className="font-semibold text-ink tabular-nums">{row?.value || 0}</span>
      </div>
    </div>
  )
}

function TurnaroundTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="mini-panel p-3 shadow-card">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-ink-3">Resolved items</span>
        <span className="font-semibold tabular-nums text-ink">{row?.count || 0}</span>
      </div>
    </div>
  )
}

function OverviewMetric({ label, value, tone = 'text-ink' }) {
  return (
    <div className="mini-panel p-2.5">
      <p className="text-caption text-ink-3">{label}</p>
      <p className={`text-[15px] font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

export default function ReconciliationOverviewPanel({
  reconciliationFunnel,
  linkedConversion,
  turnaroundDistribution,
  statementSummary,
  learnedAliasCount,
}) {
  return (
    <div className="space-y-3.5">
      <div className="card p-4">
        <p className="text-sm font-semibold text-ink mb-1">What reconciliation does</p>
        <p className="text-caption text-ink-3">
          Improves data trust before month-close by fixing uncategorized records,
          removing duplicates, and linking statement lines to transactions.
        </p>
        <p className="text-[11px] text-ink-4 mt-1">
          Quality checks and match confirmation only. Does not auto-import bank statements.
        </p>
      </div>

      {reconciliationFunnel[0]?.value > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[12px] font-semibold text-ink">Resolution funnel</p>
            <p className="text-[11px] text-ink-3 tabular-nums">{linkedConversion}% linked</p>
          </div>

          <div className="mini-panel p-2.5">
            <ResponsiveContainer width="100%" height={168}>
              <FunnelChart>
                <RechartsTooltip content={<ReconciliationFunnelTooltip />} />
                <Funnel dataKey="value" data={reconciliationFunnel} isAnimationActive>
                  <LabelList
                    position="right"
                    fill={C.inkMuted}
                    stroke="none"
                    dataKey={(entry) => `${entry.name}: ${entry.value}`}
                  />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {turnaroundDistribution.totalResolved > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[12px] font-semibold text-ink">Turnaround quality</p>
            <p className="text-[11px] text-ink-3 tabular-nums">Median {turnaroundDistribution.medianDays}d</p>
          </div>

          <div className="mini-panel p-2.5">
            <ResponsiveContainer width="100%" height={172}>
              <BarChart data={turnaroundDistribution.buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--ds-border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--ds-text-3)', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide allowDecimals={false} />
                <RechartsTooltip content={<TurnaroundTooltip />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} fill={C.brand} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!!statementSummary.total && (
        <div className="card p-4">
          <p className="text-[12px] font-semibold text-ink mb-2">Statement match stats</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <OverviewMetric label="Linked" value={statementSummary.linkedSuggestions} tone="text-ink" />
            <OverviewMetric label="Conversion" value={`${statementSummary.conversion}%`} tone="text-income-text" />
            <OverviewMetric label="Aliases" value={learnedAliasCount} tone="text-ink" />
          </div>
        </div>
      )}
    </div>
  )
}
