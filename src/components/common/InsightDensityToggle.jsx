import SectionHeader from './SectionHeader'

export default function InsightDensityToggle({
  mode = 'focus',
  onModeChange,
  title = 'Insights density',
  subtitle = 'Focus keeps action-first cards. Deep includes diagnostics and behavior analysis.',
  className = '',
}) {
  const isFocus = mode !== 'deep'

  return (
    <div className={`card p-4 border-0 ${className}`.trim()}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        badge={{
          label: isFocus ? 'Focus view' : 'Deep view',
          className: isFocus ? 'bg-brand-container text-brand-on' : 'bg-kosha-surface-2 text-ink-2',
        }}
      />

      <div className="mt-2 inline-flex items-center rounded-pill border border-kosha-border bg-kosha-surface-2 p-0.5">
        <button
          type="button"
          aria-pressed={isFocus}
          onClick={() => onModeChange?.('focus')}
          className={`h-7 px-3 rounded-pill text-[10.5px] font-semibold transition ${isFocus ? 'bg-brand text-white' : 'text-ink-2 hover:bg-kosha-surface'}`}
        >
          Focus
        </button>
        <button
          type="button"
          aria-pressed={!isFocus}
          onClick={() => onModeChange?.('deep')}
          className={`h-7 px-3 rounded-pill text-[10.5px] font-semibold transition ${!isFocus ? 'bg-brand text-white' : 'text-ink-2 hover:bg-kosha-surface'}`}
        >
          Deep
        </button>
      </div>
    </div>
  )
}
