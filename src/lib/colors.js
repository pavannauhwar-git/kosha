/**
 * Kosha palette — Stripe-inspired light theme
 *
 * Single source of truth for every colour used in inline styles,
 * Framer Motion animate props, recharts fill/stroke props,
 * SVG attributes, and Phosphor Icon color props.
 *
 * To change the palette:
 *   1. Edit values here
 *   2. Update matching CSS variables in src/index.css  (:root block)
 *   3. Update matching tokens in tailwind.config.js
 */

export const C = {

  // ── Brand — Stripe Indigo ────────────────────────────────────────
  brand:           '#635bff',
  brandMid:        '#7a73ff',
  brandLight:      '#635bff',
  brandContainer:  'rgba(99,91,255,0.08)',
  brandBorder:     'rgba(0,0,0,0.08)',

  // ── Accent — Dark navy ───────────────────────────────────────────
  accent:          '#0a2540',
  accentBg:        'rgba(10,37,64,0.06)',
  accentFill:      '#0a2540',

  // ── Income — Green ───────────────────────────────────────────────
  income:          '#0e9f6e',
  incomeText:      '#0e9f6e',

  // ── Expense — Red ────────────────────────────────────────────────
  expense:         '#e8364e',
  expenseBright:   '#e8364e',

  // ── Investment — Purple ──────────────────────────────────────────
  invest:          '#7c3aed',
  investText:      '#7c3aed',

  saved:           '#635bff',

  // ── Bills — Amber ────────────────────────────────────────────────
  bills:           '#d97706',

  // ── Ink — dark-on-light ──────────────────────────────────────────
  ink:             '#0a2540',
  inkMuted:        '#6b7c93',

  // ── Hero card overlays (white text on vivid gradient) ────────────
  heroAccent:      '#ffffff',
  heroAccentBg:    'rgba(255,255,255,0.20)',
  heroAccentSolid: '#ffffff',
  heroLabel:       'rgba(255,255,255,0.70)',
  heroDimmer:      'rgba(255,255,255,0.40)',
  heroDivider:     'rgba(255,255,255,0.18)',
  heroStatBg:      'rgba(255,255,255,0.12)',

  // ── Chart colours ────────────────────────────────────────────────
  chartIncome:     '#0e9f6e',
  chartExpense:    '#e8364e',
  chartDark:       '#f6f9fc',
  chartGrid:       'rgba(0,0,0,0.06)',
  chartCursor:     'rgba(0,0,0,0.06)',

  // ── Portfolio donut — vibrant family ─────────────────────────────
  portfolio: [
    '#635bff',
    '#7a73ff',
    '#0e9f6e',
    '#e8364e',
    '#7c3aed',
    '#d97706',
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#635bff',
  logoHighlight: '#7a73ff',
}
