/**
 * Kosha palette — Royal Indigo × Electric Lime
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

  // ── Brand — Royal Indigo ─────────────────────────────────────────
  brand:           '#4b0082',
  brandMid:        '#6a1b9a',
  brandLight:      '#7c4dff',
  brandContainer:  'rgba(75,0,130,0.08)',
  brandBorder:     'rgba(0,0,0,0.08)',

  // ── Accent — readable indigo for light surfaces ─────────────────
  accent:          '#4b0082',
  accentBg:        'rgba(75,0,130,0.10)',
  accentFill:      '#4b0082',

  // ── Electric lime highlight (use on dark/hero surfaces) ─────────
  electric:        '#CCFF00',
  electricBg:      'rgba(204,255,0,0.10)',

  // ── Ink — deep indigo-black on light ─────────────────────────────
  ink:             '#1a0a2e',
  inkMuted:        '#6b7c93',

  // ── Income — Green ───────────────────────────────────────────────
  income:          '#0e9f6e',
  incomeText:      '#0e9f6e',

  // ── Expense — Red ────────────────────────────────────────────────
  expense:         '#e8364e',
  expenseBright:   '#e8364e',

  // ── Investment — Purple ──────────────────────────────────────────
  invest:          '#7c3aed',
  investText:      '#7c3aed',

  saved:           '#4b0082',

  // ── Bills — Amber ────────────────────────────────────────────────
  bills:           '#d97706',

  // ── Hero card overlays (white/lime text on deep indigo gradient) ─
  heroAccent:      '#CCFF00',
  heroAccentBg:    'rgba(204,255,0,0.16)',
  heroAccentSolid: '#CCFF00',
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
    '#4b0082',
    '#6a1b9a',
    '#0e9f6e',
    '#e8364e',
    '#7c3aed',
    '#d97706',
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#4b0082',
  logoHighlight: '#6a1b9a',
}
