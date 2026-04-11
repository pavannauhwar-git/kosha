import { ArrowLeft } from 'lucide-react'

export default function PageBackHeader({
  title,
  onBack,
  rightSlot = null,
  className = '',
}) {
  return (
    <div
      className={`app-topbar ${className}`.trim()}
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
    >
      <div className="app-topbar-inner">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border flex items-center justify-center active:bg-kosha-surface-2"
        >
          <ArrowLeft size={16} className="text-ink-2" />
        </button>

        <h1 className="text-[17px] font-bold leading-tight text-ink tracking-tight flex-1 truncate">{title}</h1>

        {rightSlot ? (
          <div className="shrink-0">{rightSlot}</div>
        ) : (
          <div className="w-9 h-9 shrink-0" aria-hidden />
        )}
      </div>
    </div>
  )
}