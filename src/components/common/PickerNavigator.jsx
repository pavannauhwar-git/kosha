import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PickerNavigator({
  label,
  onPrev,
  onNext,
  pickerRef,
  inputType = 'month',
  inputValue,
  onInputChange,
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <button
        onClick={onPrev}
        className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                   flex items-center justify-center active:bg-kosha-surface-2"
      >
        <ChevronLeft size={18} className="text-ink-2" />
      </button>

      <button
        type="button"
        className="relative cursor-pointer"
        onClick={() => pickerRef?.current?.showPicker?.()}
      >
        <h1 className="text-display font-bold text-ink tracking-tight">{label}</h1>
        <input
          ref={pickerRef}
          type={inputType}
          value={inputValue}
          onChange={onInputChange}
          className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
        />
      </button>

      <button
        onClick={onNext}
        className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                   flex items-center justify-center active:bg-kosha-surface-2"
      >
        <ChevronRight size={18} className="text-ink-2" />
      </button>
    </div>
  )
}
