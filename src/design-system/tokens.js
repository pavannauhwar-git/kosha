/**
 * Kosha Design System — "Vibrant Clarity"
 *
 * Anchored to brand blue #007FFF with warm yellow #FFFF99 accent.
 * Material 3 Expressive applied to personal finance.
 * Numbers as heroes, rounded containers, confident typography.
 */

export const tokens = {
  colors: {
    /* ── Primary — Vibrant Blue ──────────────────────────────── */
    primary:           '#007FFF',
    primaryDark:       '#0066CC',
    primaryLight:      '#4DA6FF',
    primaryContainer:  '#E0F0FF',
    onPrimary:         '#FFFFFF',
    onPrimaryContainer:'#003366',

    /* ── Accent — Sunny Yellow ───────────────────────────────── */
    accent:            '#FFFF99',
    accentDark:        '#E6E600',
    accentContainer:   '#FFFDE0',
    onAccent:          '#3D3D00',

    /* ── Surface ─────────────────────────────────────────────── */
    surface:           '#FFFFFF',
    surfaceDim:        '#F4F6F8',
    surfaceBright:     '#FAFBFC',
    surfaceContainer:  '#EEF1F4',
    surfaceContainerHigh: '#E8ECF0',
    surfaceContainerHighest: '#E2E6EA',

    /* ── Dark mode surfaces ──────────────────────────────────── */
    surfaceDark:              '#111318',
    surfaceDimDark:           '#191C20',
    surfaceContainerDark:     '#1D2024',
    surfaceContainerHighDark: '#272A2E',
    surfaceContainerHighestDark: '#323538',

    /* ── Text / Ink ──────────────────────────────────────────── */
    text:              '#111318',
    textSecondary:     '#44474E',
    textTertiary:      '#74777F',
    textDisabled:      '#B0B3BA',
    textOnDark:        '#E2E6EA',
    textOnDarkSecondary: 'rgba(255,255,255,0.70)',
    textOnDarkTertiary:  'rgba(255,255,255,0.45)',

    /* ── Border ──────────────────────────────────────────────── */
    border:            'rgba(17,19,24,0.08)',
    borderStrong:      'rgba(17,19,24,0.16)',
    borderDark:        'rgba(255,255,255,0.08)',
    borderStrongDark:  'rgba(255,255,255,0.16)',

    /* ── Status — Income (Emerald) ───────────────────────────── */
    income:            '#0F9D58',
    incomeBg:          '#E8F5E9',
    incomeText:        '#0B7A42',
    incomeBorder:      '#C8E6C9',

    /* ── Status — Expense (Coral) ────────────────────────────── */
    expense:           '#E8453C',
    expenseBg:         '#FDECEA',
    expenseText:       '#C62828',
    expenseBorder:     '#FFCDD2',

    /* ── Status — Investment (Indigo) ────────────────────────── */
    invest:            '#5C6BC0',
    investBg:          '#E8EAF6',
    investText:        '#283593',
    investBorder:      '#C5CAE9',

    /* ── Status — Repayment (Amber) ──────────────────────────── */
    repay:             '#F9A825',
    repayBg:           '#FFF8E1',
    repayText:         '#F57F17',
    repayBorder:       '#FFF9C4',

    /* ── Warning ─────────────────────────────────────────────── */
    warning:           '#F9A825',
    warningBg:         '#FFF8E1',
    warningText:       '#E65100',
    warningBorder:     '#FFE0B2',

    /* ── Danger / Error ──────────────────────────────────────── */
    danger:            '#E8453C',
    dangerBg:          '#FDECEA',
    dangerText:        '#C62828',

    /* ── Success ─────────────────────────────────────────────── */
    success:           '#0F9D58',
    successBg:         '#E8F5E9',

    /* ── Recurring badge ─────────────────────────────────────── */
    recurring:         '#007FFF',
    recurringBg:       '#E0F0FF',
    recurringText:     '#0066CC',

    /* ── Repayment badge ─────────────────────────────────────── */
    repaymentBadge:    '#F9A825',
    repaymentBadgeBg:  '#FFF8E1',
    repaymentBadgeText:'#F57F17',
  },

  typography: {
    fontFamily: {
      sans: ['InterVariable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
    },
    scale: {
      xs:      { size: '11px', lineHeight: '1.45', letterSpacing: '0.02em',  weight: 500 },
      sm:      { size: '13px', lineHeight: '1.4',  letterSpacing: '0.005em', weight: 400 },
      base:    { size: '15px', lineHeight: '1.55', letterSpacing: '0em',     weight: 400 },
      lg:      { size: '17px', lineHeight: '1.4',  letterSpacing: '-0.01em', weight: 500 },
      xl:      { size: '20px', lineHeight: '1.3',  letterSpacing: '-0.015em',weight: 600 },
      '2xl':   { size: '24px', lineHeight: '1.2',  letterSpacing: '-0.02em', weight: 700 },
      '3xl':   { size: '32px', lineHeight: '1.1',  letterSpacing: '-0.025em',weight: 700 },
      '4xl':   { size: '40px', lineHeight: '1.05', letterSpacing: '-0.03em', weight: 800 },
      '5xl':   { size: '48px', lineHeight: '0.95', letterSpacing: '-0.035em',weight: 800 },
    },
    weights: {
      regular:  400,
      medium:   500,
      semibold: 600,
      bold:     700,
      black:    800,
    },
  },

  spacing: {
    px: '1px',
    0:  '0px',
    0.5:'2px',
    1:  '4px',
    1.5:'6px',
    2:  '8px',
    2.5:'10px',
    3:  '12px',
    3.5:'14px',
    4:  '16px',
    5:  '20px',
    6:  '24px',
    7:  '28px',
    8:  '32px',
    9:  '36px',
    10: '40px',
    11: '44px',
    12: '48px',
    14: '56px',
    16: '64px',
    20: '80px',
  },

  radius: {
    sm:   '8px',
    md:   '12px',
    lg:   '16px',
    xl:   '20px',
    '2xl':'24px',
    '3xl':'28px',
    full: '9999px',
  },

  shadows: {
    sm:   '0 1px 2px rgba(17,19,24,0.04), 0 2px 8px rgba(17,19,24,0.03)',
    md:   '0 2px 4px rgba(17,19,24,0.05), 0 4px 16px rgba(17,19,24,0.05)',
    lg:   '0 4px 8px rgba(17,19,24,0.06), 0 12px 32px rgba(17,19,24,0.08)',
    xl:   '0 8px 16px rgba(17,19,24,0.08), 0 24px 48px rgba(17,19,24,0.10)',
    glow: '0 0 0 3px rgba(0,127,255,0.15)',
    fab:  '0 6px 20px rgba(0,127,255,0.30), 0 2px 8px rgba(0,127,255,0.15)',
  },

  animation: {
    duration: {
      instant: '80ms',
      fast:    '120ms',
      base:    '200ms',
      slow:    '350ms',
      slower:  '500ms',
    },
    easing: {
      standard:  'cubic-bezier(0.2, 0, 0, 1)',
      decelerate:'cubic-bezier(0, 0, 0, 1)',
      accelerate:'cubic-bezier(0.3, 0, 1, 1)',
      spring:    'cubic-bezier(0.34, 1.56, 0.64, 1)',
      bounce:    'cubic-bezier(0.34, 1.4, 0.64, 1)',
    },
  },
}
