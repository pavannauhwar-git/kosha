import { forwardRef, useCallback, useId, useRef, useState } from 'react'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'

const TYPE_COLORS = {
  income: {
    ring: 'var(--ds-income)',
    bg: 'var(--ds-income-bg)',
    text: 'var(--ds-income-text)',
  },
  expense: {
    ring: 'var(--ds-expense)',
    bg: 'var(--ds-expense-bg)',
    text: 'var(--ds-expense-text)',
  },
  investment: {
    ring: 'var(--ds-invest)',
    bg: 'var(--ds-invest-bg)',
    text: 'var(--ds-invest-text)',
  },
}

/**
 * AmountInput — currency-aware amount field wrapping MUI TextField.
 */
const AmountInput = forwardRef(function AmountInput(
  {
    value,
    onChange,
    type = 'expense',
    currency = 'INR',
    autoFocus,
    error,
    placeholder = '0',
    className = '',
    ...rest
  },
  ref
) {
  const id = useId()
  const innerRef = useRef(null)
  const inputRef = ref || innerRef
  const [focused, setFocused] = useState(false)
  const colors = TYPE_COLORS[type] || TYPE_COLORS.expense

  const handleChange = useCallback(
    (e) => {
      let raw = e.target.value
      if (raw.startsWith('+')) raw = raw.slice(1)
      if (raw.toLowerCase().includes('e')) return
      
      if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
        onChange(raw)
      }
    },
    [onChange]
  )

  const handleBlur = useCallback(
    (e) => {
      setFocused(false)
      if (value && !isNaN(Number(value))) {
        const num = parseFloat(value)
        if (!isNaN(num)) {
          onChange(String(num))
        }
      }
    },
    [value, onChange]
  )

  const symbol = currency === 'INR' ? '₹' : '$'
  const hasError = Boolean(error)

  return (
    <TextField
      id={id}
      inputRef={inputRef}
      value={value}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      autoFocus={autoFocus}
      error={hasError}
      helperText={error}
      fullWidth
      variant="outlined"
      className={className}
      autoComplete="off"
      slotProps={{
        htmlInput: {
          inputMode: 'decimal',
          pattern: '[0-9.]*',
        },
        input: {
          startAdornment: (
            <InputAdornment
              position="start"
              disablePointerEvents
              sx={{
                '& .MuiTypography-root': {
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: colors.text,
                  lineHeight: 1,
                },
              }}
            >
              {symbol}
            </InputAdornment>
          ),
          sx: {
            borderRadius: '20px',
            backgroundColor: focused ? colors.bg : 'var(--ds-surface-container)',
            transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)',
            py: 1,
            '& .MuiOutlinedInput-input': {
              fontSize: '32px',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              py: '8px',
              paddingLeft: '4px',
              color: 'var(--ds-text)',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: hasError ? 'var(--ds-expense)' : 'transparent',
              borderWidth: '2px',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: hasError ? 'var(--ds-expense)' : focused ? colors.ring : 'transparent',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.ring,
              borderWidth: '2px',
            },
          },
        },
        formHelperText: {
          sx: {
            fontSize: '11px',
            color: 'var(--ds-expense-text)',
            marginLeft: '4px',
            marginTop: '4px',
          },
        },
      }}
      {...rest}
    />
  )
})

export default AmountInput
