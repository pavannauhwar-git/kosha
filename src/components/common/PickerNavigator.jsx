import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PickerNavigator({
  label,
  onPrev,
  onNext,
  pickerRef,
  inputType = 'month',
  inputValue,
  onInputChange,
  className = 'mb-4',
}) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <button
        onClick={onPrev}
        className="w-8 h-8 rounded-full bg-kosha-surface border border-kosha-border
                   flex items-center justify-center active:bg-kosha-surface-2
                   hover:bg-kosha-surface-2 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:outline-none transition-all duration-150"
      >
        <ChevronLeft size={16} className="text-ink-2" />
      </button>

      <button
        type="button"
        className="relative cursor-pointer"
        onClick={() => pickerRef?.current?.showPicker?.()}
      >
        <h1 className="text-value font-semibold text-ink tracking-tight">{label}</h1>
        <input
          ref={pickerRef}
          type={inputType}
          name="date-picker"
          value={inputValue}
          onChange={onInputChange}
          className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
        />
      </button>

      <button
        onClick={onNext}
        className="w-8 h-8 rounded-full bg-kosha-surface border border-kosha-border
                   flex items-center justify-center active:bg-kosha-surface-2
                   hover:bg-kosha-surface-2 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:outline-none transition-all duration-150"
      >
        <ChevronRight size={16} className="text-ink-2" />
      </button>
    </div>
  )
}
