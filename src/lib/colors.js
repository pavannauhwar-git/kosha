export const C = {

  // ── Brand — Vibrant Blue ─────────────────────────────────────────
  brand:           'var(--ds-primary)',
  brandMid:        'var(--ds-primary-light)',
  brandLight:      'var(--ds-primary-light)',
  brandMuted:      'rgba(var(--ds-primary-rgb),0.22)',
  brandContainer:  'var(--ds-primary-container)',
  brandBorder:     'var(--ds-border)',

  // ── Contrast Accent — Sunny yellow ───────────────────────────────
  accent:          'var(--ds-accent)',
  accentBg:        'rgba(255,255,153,0.18)',
  accentFill:      'var(--ds-accent-dark)',

  // ── Income — Emerald ──────────────────────────────────────────────
  income:          'var(--ds-income)',
  incomeText:      'var(--ds-income-text)',

  // ── Expense — Coral ───────────────────────────────────────────────
  expense:         'var(--ds-expense)',
  expenseBright:   'var(--ds-expense-text)',

  // ── Investment — Indigo ───────────────────────────────────────────
  invest:          'var(--ds-invest)',
  investText:      'var(--ds-invest-text)',

  saved:           'var(--ds-primary)',

  // ── Bills — Amber ─────────────────────────────────────────────────
  bills:           'var(--ds-warning)',
  warningMuted:    'rgba(249,168,37,0.60)',

  // ── Ink — clean neutrals ──────────────────────────────────────────
  ink:             'var(--ds-text)',
  inkMuted:        'var(--ds-text-tertiary)',

  // ── Hero card overlays (light text on blue hero) ──────────────────
  heroAccent:      '#FFFF99',
  heroAccentBg:    'rgba(255,255,153,0.15)',
  heroAccentSolid: '#FFFF99',
  heroLabel:       'rgba(255,255,255,0.70)',
  heroDimmer:      'rgba(255,255,255,0.45)',
  heroDivider:     'rgba(255,255,255,0.12)',
  heroStatBg:      'rgba(255,255,255,0.10)',

  // ── Chart colours — vibrant clarity ───────────────────────────────
  chartIncome:     'var(--ds-income)',
  chartExpense:    'var(--ds-expense)',
  chartDark:       'var(--ds-primary)',
  chartGrid:       'rgba(var(--ds-text-rgb),0.10)',
  chartCursor:     'rgba(var(--ds-primary-rgb),0.10)',

  // ── Portfolio donut — distinct jewel tones ───────────────────────
  // Each stop is a different hue so segments are immediately distinguishable.
  // Order: Sapphire · Emerald · Violet · Amber · Cyan · Slate
  portfolio: [
    '#007FFF',  // 0 — Sapphire  (brand anchor)
    '#10B981',  // 1 — Emerald
    '#8B5CF6',  // 2 — Violet
    '#F59E0B',  // 3 — Amber
    '#06B6D4',  // 4 — Cyan
    '#64748B',  // 5 — Slate  (also used for "Other")
  ],

  // Dark-mode variants — slightly lighter / more saturated so they pop on dark surfaces
  portfolioDark: [
    '#4DA6FF',  // 0 — Sapphire light
    '#34D399',  // 1 — Emerald light
    '#A78BFA',  // 2 — Violet light
    '#FCD34D',  // 3 — Amber light
    '#22D3EE',  // 4 — Cyan light
    '#94A3B8',  // 5 — Slate light
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#007FFF',
  logoHighlight: '#FFFF99',
}
