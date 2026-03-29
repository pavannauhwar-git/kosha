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

  // ── Brand — Zaffre ───────────────────────────────────────────────
  brand:           '#0014A8',
  brandMid:        '#1E36D8',
  brandLight:      '#4E63F0',
  brandContainer:  '#E2E7FF',
  brandBorder:     '#B8C4FF',

  // ── Accent — Chartreuse ──────────────────────────────────────────
  // Reserved for hero-card highlights over dark brand surfaces.
  // Keep usage sparse to avoid visual noise.
  accent:          '#7FFF00',
  accentBg:        'rgba(127,255,0,0.16)',
  accentFill:      'rgba(127,255,0,0.66)',

  // ── Income — Emerald H=174° ───────────────────────────────────────
  income:          '#059669',
  incomeText:      '#047857',

  // ── Expense — Rose H=354° ─────────────────────────────────────────
  expense:         '#E11D48',
  expenseBright:   '#E11D48',   // same — no separate "bright" needed

  // ── Investment — Violet Accent ────────────────────────────────────
  invest:          '#C026D3',
  investText:      '#7A1F84',

  saved:           '#0014A8',

  // ── Bills — Amber H=84° ───────────────────────────────────────────
  bills:           '#A16207',

  // ── Ink — indigo-tinted neutrals ─────────────────────────────────
  ink:             '#141B47',
  inkMuted:        '#5E6AA8',

  // ── Hero card overlays (Chartreuse over deep brand) ──────────────
  heroAccent:      'rgba(127,255,0,0.66)',
  heroAccentBg:    'rgba(127,255,0,0.16)',
  heroAccentSolid: '#A4FF3F',
  heroLabel:       'rgba(255,255,255,0.64)', // labels and helper copy on hero
  heroDimmer:      'rgba(255,255,255,0.46)', // low-priority watermark/meta
  heroDivider:     'rgba(255,255,255,0.16)', // horizontal rule
  heroStatBg:      'rgba(255,255,255,0.12)', // stat chips on hero

  // ── Chart glow colours — on dark periwinkle card background ──────
  // Brighter variants of semantic colours so they glow on dark substrate
  chartIncome:     '#34D399',   // bright emerald glow on dark
  chartExpense:    '#FB7185',   // bright rose glow on dark
  chartDark:       '#000D78',
  chartGrid:       'rgba(255,255,255,0.06)', // grid lines on dark card
  chartCursor:     'rgba(255,255,255,0.06)', // tooltip cursor on dark card

  // ── Portfolio donut — periwinkle family, darkest → lightest ──────
  portfolio: [
    '#141B47',
    '#0014A8',
    '#1E36D8',
    '#4E63F0',
    '#E2E7FF',
    '#B8C4FF',
  ],

  // ── Logo SVG (no Chartreuse) ─────────────────────────────────────
  logoBg:        '#0014A8',
  logoHighlight: '#FFFFFF',
}
