export default function StatMini({ label, value, tone = 'text-ink', className = '' }) {
  return (
    <div className={`rounded-card bg-kosha-surface-2 p-2.5 ${className}`.trim()}>
      <p className="text-caption tracking-wide text-ink-3">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}
