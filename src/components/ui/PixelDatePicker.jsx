import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import BottomSheet from './BottomSheet'
import Button from './Button'

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
})

const DISPLAY_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIsoDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfMonthGrid(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, 12)
  const mondayFirstOffset = (first.getDay() + 6) % 7
  return addDays(first, -mondayFirstOffset)
}

function buildMonthGrid(viewDate) {
  const start = startOfMonthGrid(viewDate)
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index)
    return {
      date,
      iso: toIsoDate(date),
      inMonth: date.getMonth() === viewDate.getMonth(),
    }
  })
}

function isSameDay(a, b) {
  return !!a && !!b && toIsoDate(a) === toIsoDate(b)
}

export default function PixelDatePicker({
  value,
  onChange,
  disabled = false,
  name,
  placeholder = 'Select date',
  sheetTitle = 'Pick a date',
  clearable = false,
  className = '',
}) {
  const selectedDate = useMemo(() => parseIsoDate(value), [value])
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date())

  const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate])
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  }, [])

  useEffect(() => {
    if (open) {
      setViewDate(selectedDate || new Date())
    }
  }, [open, selectedDate])

  const displayText = selectedDate ? DISPLAY_FORMATTER.format(selectedDate) : placeholder

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={[
          'min-w-[122px] shrink-0 text-[15px] bg-transparent outline-none text-right',
          selectedDate ? 'text-ink-3' : 'text-ink-4',
          disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer',
          className,
        ].join(' ')}
      >
        {displayText}
      </button>

      {name ? <input type="hidden" name={name} value={value || ''} /> : null}

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={sheetTitle}
      >
        <div className="pb-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              type="button"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1, 12))}
              className="w-9 h-9 rounded-full border border-kosha-border bg-kosha-surface-2 text-ink-2 flex items-center justify-center active:scale-[0.97]"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>

            <p className="text-[15px] font-semibold text-ink tracking-tight">
              {MONTH_FORMATTER.format(viewDate)}
            </p>

            <button
              type="button"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1, 12))}
              className="w-9 h-9 rounded-full border border-kosha-border bg-kosha-surface-2 text-ink-2 flex items-center justify-center active:scale-[0.97]"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="h-7 flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
                {label.slice(0, 1)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthGrid.map((day) => {
              const isSelected = isSameDay(day.date, selectedDate)
              const isToday = isSameDay(day.date, today)

              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => {
                    onChange(day.iso)
                    setOpen(false)
                  }}
                  className={[
                    'h-9 rounded-full text-[12px] font-semibold transition-[transform,background-color] duration-150 will-change-transform',
                    isSelected
                      ? 'bg-brand text-white shadow-[0_4px_10px_rgba(0,127,255,0.26)]'
                      : day.inMonth
                        ? 'text-ink hover:bg-kosha-surface-2'
                        : 'text-ink-4 hover:bg-kosha-surface-2/70',
                    !isSelected && isToday ? 'ring-1 ring-brand/35' : '',
                  ].join(' ')}
                  aria-label={DISPLAY_FORMATTER.format(day.date)}
                >
                  {day.date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            {clearable && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                Clear
              </Button>
            )}
            <Button
              type="button"
              variant="tonal"
              size="sm"
              onClick={() => {
                onChange(toIsoDate(today))
                setOpen(false)
              }}
            >
              Today
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
