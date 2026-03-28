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

  // ── Brand — Royal Indigo ─────────────────────────────────────────
  brand:           '#5b21b6', // Royal Indigo
  brandMid:        '#6d28d9',
  brandLight:      '#8b5cf6',
  brandContainer:  '#ede9fe',
  brandBorder:     '#E2E8F0',

  // ── Accent — Chartreuse ──────────────────────────────────────────
  accent:          '#7FFF00', // Chartreuse
  accentBg:        'rgba(127,255,0,0.22)',
  accentFill:      'rgba(127,255,0,0.78)',

  // ── Income — Emerald ─────────────────────────────────────────────
  income:          '#10B981',
  incomeText:      '#047857',

  // ── Expense — Rose ───────────────────────────────────────────────
  expense:         '#F43F5E',
  expenseBright:   '#F43F5E',

  // ── Investment — Violet ──────────────────────────────────────────
  invest:          '#8B5CF6',
  investText:      '#5B21B6',

  saved:           '#4F46E5',

  // ── Bills — Amber ────────────────────────────────────────────────
  bills:           '#F59E0B',

  // ── Ink — Slate Neutrals ─────────────────────────────────────────
  ink:             '#0F172A',
  inkMuted:        '#64748B',

  // ── Hero card overlays ───────────────────────────────────────────
  heroAccent:      'rgba(127,255,0,0.78)', // Chartreuse
  heroAccentBg:    'rgba(127,255,0,0.22)',
  heroAccentSolid: '#7FFF00',
  heroLabel:       'rgba(255,255,255,0.65)',
  heroDimmer:      'rgba(255,255,255,0.35)',
  heroDivider:     'rgba(255,255,255,0.15)',
  heroStatBg:      'rgba(255,255,255,0.15)',

  // ── Chart glow colours ───────────────────────────────────────────
  chartIncome:     '#34D399',
  chartExpense:    '#FB7185',
  chartDark:       '#312e81',
  chartGrid:       'rgba(255,255,255,0.06)',
  chartCursor:     'rgba(255,255,255,0.06)',

  // ── Portfolio donut — royalty indigo family, darkest → lightest ──────────
  portfolio: [
    '#2e1065',
    '#312e81',
    '#4c1d95',
    '#5b21b6',
    '#6d28d9',
    '#8b5cf6',
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#5b21b6',
  logoHighlight: '#7FFF00',
}
