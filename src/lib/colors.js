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
  accentBg:        'var(--ds-accent-container)',
  accentFill:      'var(--ds-accent)',
  accentText:      'var(--ds-accent-text)',

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
  heroAccent:      'var(--c-hero-accent)',
  heroAccentBg:    'var(--c-hero-accent-bg)',
  heroAccentSolid: 'var(--c-hero-accent-fill)',
  heroLabel:       'var(--c-hero-label)',
  heroDimmer:      'var(--c-hero-dimmer)',
  heroDivider:     'var(--c-hero-divider)',
  heroStatBg:      'var(--c-hero-stat-bg)',

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
    'var(--ds-primary)',        // 0 — Brand anchor
    'var(--ds-accent)',         // 1 — Brand accent
    'var(--ds-primary-light)',  // 2 — Light blue
    'var(--ds-accent-dark)',    // 3 — High-contrast yellow
    '#94A3B8',                  // 4 — Slate (neutral)
    '#64748B',                  // 5 — Slate dark
  ],

  // Dark-mode variants — keeping consistent brand ramps
  portfolioDark: [
    'var(--ds-primary)',
    'var(--ds-accent)',
    'rgba(var(--ds-primary-rgb), 0.7)',
    'var(--ds-accent-dark)',
    '#94A3B8',
    '#64748B',
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#007FFF',
  logoHighlight: '#FFFF99',
}
