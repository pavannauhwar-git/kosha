/**
 * Kosha palette — Stripe-inspired dark theme
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
  brandLight:      '#a5b4fc',
  brandContainer:  'rgba(99,91,255,0.15)',
  brandBorder:     'rgba(255,255,255,0.10)',

  // ── Accent — Cyan ────────────────────────────────────────────────
  accent:          '#80e9ff',
  accentBg:        'rgba(128,233,255,0.15)',
  accentFill:      '#80e9ff',

  // ── Income — Teal ────────────────────────────────────────────────
  income:          '#00d4aa',
  incomeText:      '#00d4aa',

  // ── Expense — Rose ───────────────────────────────────────────────
  expense:         '#ff5c83',
  expenseBright:   '#ff5c83',

  // ── Investment — Purple ──────────────────────────────────────────
  invest:          '#a960ee',
  investText:      '#c084fc',

  saved:           '#635bff',

  // ── Bills — Gold ─────────────────────────────────────────────────
  bills:           '#f7b32b',

  // ── Ink — light-on-dark ──────────────────────────────────────────
  ink:             '#f6f9fc',
  inkMuted:        '#8898aa',

  // ── Hero card overlays ───────────────────────────────────────────
  heroAccent:      '#80e9ff',
  heroAccentBg:    'rgba(128,233,255,0.15)',
  heroAccentSolid: '#80e9ff',
  heroLabel:       'rgba(255,255,255,0.55)',
  heroDimmer:      'rgba(255,255,255,0.25)',
  heroDivider:     'rgba(255,255,255,0.08)',
  heroStatBg:      'rgba(255,255,255,0.06)',

  // ── Chart glow colours ───────────────────────────────────────────
  chartIncome:     '#00d4aa',
  chartExpense:    '#ff5c83',
  chartDark:       '#0d2d4d',
  chartGrid:       'rgba(255,255,255,0.06)',
  chartCursor:     'rgba(255,255,255,0.08)',

  // ── Portfolio donut — indigo/cyan family ────────────────────────
  portfolio: [
    '#635bff',
    '#7a73ff',
    '#a5b4fc',
    '#80e9ff',
    '#00d4aa',
    '#a960ee',
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#635bff',
  logoHighlight: '#80e9ff',
}
