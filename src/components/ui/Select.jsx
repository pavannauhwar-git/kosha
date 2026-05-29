import { forwardRef } from 'react'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import SelectMui from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormHelperText from '@mui/material/FormHelperText'

/**
 * Select — Premium, unified select component wrapping MUI Select.
 * Consistently styled with our CSS design tokens and fully accessible.
 */
const Select = forwardRef(function Select(
  {
    label,
    value,
    onChange,
    options = [], // [{ value: '...', label: '...' }]
    error,
    helperText,
    disabled,
    className = '',
    fullWidth = true,
    size = 'small',
    placeholder,
    sx = {},
    ...rest
  },
  ref
) {
  const hasError = Boolean(error)
  const resolvedHelperText = error || helperText

  return (
    <FormControl
      fullWidth={fullWidth}
      error={hasError}
      disabled={disabled}
      className={className}
      size={size}
    >
      {label && <InputLabel id={`mui-select-label-${label}`}>{label}</InputLabel>}
      <SelectMui
        labelId={label ? `mui-select-label-${label}` : undefined}
        ref={ref}
        value={value ?? ''}
        onChange={onChange}
        label={label}
        displayEmpty={!!placeholder}
        sx={{
          borderRadius: '16px',
          '& .MuiSelect-select': {
            borderRadius: '16px',
            fontSize: '14px',
            color: 'var(--ds-text)',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--ds-border)',
            transition: 'border-color 150ms ease',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--ds-text-secondary)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--ds-primary)',
          },
          backgroundColor: 'var(--ds-surface-container)',
          color: 'var(--ds-text)',
          ...sx,
        }}
        {...rest}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            {placeholder}
          </MenuItem>
        )}
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </SelectMui>
      {resolvedHelperText && <FormHelperText>{resolvedHelperText}</FormHelperText>}
    </FormControl>
  )
})

export default Select
