import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PickerNavigator({
  label,
  onPrev,
  onNext,
  pickerRef,
  inputType = 'month',
  inputValue,
  onInputChange,
  className = 'mb-6',
}) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <button
        onClick={onPrev}
        className="w-10 h-10 rounded-[20px] oneui-glass border border-kosha-border
                   flex items-center justify-center active:scale-[0.97] transition-transform duration-75"
      >
        <ChevronLeft size={18} className="text-ink-2" />
      </button>

      <button
        type="button"
        className="relative cursor-pointer"
        onClick={() => pickerRef?.current?.showPicker?.()}
      >
        <h1 className="text-[30px] leading-[1.05] font-black text-ink tracking-tight">{label}</h1>
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
        className="w-10 h-10 rounded-[20px] oneui-glass border border-kosha-border
                   flex items-center justify-center active:scale-[0.97] transition-transform duration-75"
      >
        <ChevronRight size={18} className="text-ink-2" />
      </button>
    </div>
  )
}
