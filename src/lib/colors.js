/**
 * Kosha palette — JS constants
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

  // ── Brand — Google blue family ───────────────────────────────────
  brand:           '#0B57D0',
  brandMid:        '#4285F4',
  brandLight:      '#A8C7FA',
  brandContainer:  '#D3E3FD',
  brandBorder:     '#D9E2F1',

  // ── Accent — blue tonal highlight ─────────────────────────────────
  accent:          '#A8C7FA',
  accentBg:        'rgba(168,199,250,0.24)',
  accentFill:      'rgba(168,199,250,0.78)',

  // ── Income — Emerald H=174° ───────────────────────────────────────
  income:          '#0F9D58',
  incomeText:      '#137333',

  // ── Expense — Rose H=354° ─────────────────────────────────────────
  expense:         '#C5221F',
  expenseBright:   '#D93025',

  // ── Investment — Sky Blue H=200° (MD3 Secondary) ───────────────────
  invest:          '#1A73E8',
  investText:      '#174EA6',

  saved:           '#0B57D0',

  // ── Bills — Amber H=84° ───────────────────────────────────────────
  bills:           '#B06000',

  // ── Ink — indigo-tinted neutrals ─────────────────────────────────
  ink:             '#1F2937',
  inkMuted:        '#64748B',

  // ── Hero card overlays (lime/white on deep periwinkle) ────────────
  heroAccent:      'rgba(168,199,250,0.78)',
  heroAccentBg:    'rgba(168,199,250,0.24)',
  heroAccentSolid: '#A8C7FA',
  heroLabel:       'rgba(255,255,255,0.55)', // "Total balance" label
  heroDimmer:      'rgba(255,255,255,0.35)', // "KOSHA" watermark
  heroDivider:     'rgba(255,255,255,0.12)', // horizontal rule
  heroStatBg:      'rgba(255,255,255,0.10)', // Earned/Spent/Invested chips

  // ── Chart glow colours — on dark #1E1B4B card background ─────────
  // Brighter variants of semantic colours so they glow on dark substrate
  chartIncome:     '#57C47A',
  chartExpense:    '#F28B82',
  chartDark:       '#0A3F99',
  chartGrid:       'rgba(255,255,255,0.06)', // grid lines on dark card
  chartCursor:     'rgba(255,255,255,0.06)', // tooltip cursor on dark card

  // ── Portfolio donut — periwinkle family, darkest → lightest ──────
  portfolio: ['#0842A0', '#0B57D0', '#4285F4', '#A8C7FA', '#D3E3FD', '#EAF1FF'],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#0B57D0',
  logoHighlight: '#A8C7FA',
}
