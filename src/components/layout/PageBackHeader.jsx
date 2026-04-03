import { ArrowLeft } from 'lucide-react'

export default function PageBackHeader({
  title,
  onBack,
  rightSlot = null,
  className = '',
}) {
  return (
    <div
      className={`app-header app-header--back gap-3 ${className}`.trim()}
    >
      <button
        type="button"
        onClick={onBack}
        className="app-header-back-btn"
      >
        <ArrowLeft size={16} className="text-ink-2" />
      </button>

      <h1 className="app-header-title-back">{title}</h1>

      {rightSlot ? (
        <div className="shrink-0">{rightSlot}</div>
      ) : (
        <div className="w-9 h-9 shrink-0" aria-hidden />
      )}
    </div>
  )
}