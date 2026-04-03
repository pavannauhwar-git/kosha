export default function StatMini({ label, value, tone = 'text-ink', className = '' }) {
  return (
    <div className={`mini-panel p-2.5 ${className}`.trim()}>
      <p className="text-caption text-ink-3">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}
