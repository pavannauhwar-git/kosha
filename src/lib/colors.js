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

  // ── Brand — Periwinkle Violet ────────────────────────────────────
  brand:           '#4D59E8',
  brandMid:        '#7782FF',
  brandLight:      '#9AA5FF',
  brandContainer:  '#EEF0FF',
  brandBorder:     '#DDE2FF',

  // ── Accent — Lime Yellow ─────────────────────────────────────────
  // Used ONLY against dark periwinkle backgrounds (hero card, logo).
  // Never use on white — fails contrast.
  accent:          '#E4FF5E',
  accentBg:        'rgba(228,255,94,0.22)',
  accentFill:      'rgba(228,255,94,0.78)',

  // ── Income — Emerald H=174° ───────────────────────────────────────
  income:          '#059669',
  incomeText:      '#047857',

  // ── Expense — Rose H=354° ─────────────────────────────────────────
  expense:         '#E11D48',
  expenseBright:   '#E11D48',   // same — no separate "bright" needed

  // ── Investment — Sky Blue H=200° (MD3 Secondary) ───────────────────
  invest:          '#0284C7',   // sky-600
  investText:      '#0369A1',   // sky-700

  saved:           '#4D59E8',   // brand periwinkle — residual money in Kosha

  // ── Bills — Amber H=84° ───────────────────────────────────────────
  bills:           '#CA8A04',

  // ── Ink — indigo-tinted neutrals ─────────────────────────────────
  ink:             '#1F255F',
  inkMuted:        '#6E75A8',

  // ── Hero card overlays (lime/white on deep periwinkle) ────────────
  heroAccent:      'rgba(228,255,94,0.78)',
  heroAccentBg:    'rgba(228,255,94,0.22)',
  heroAccentSolid: '#E4FF5E',
  heroLabel:       'rgba(255,255,255,0.55)', // "Total balance" label
  heroDimmer:      'rgba(255,255,255,0.35)', // "KOSHA" watermark
  heroDivider:     'rgba(255,255,255,0.12)', // horizontal rule
  heroStatBg:      'rgba(255,255,255,0.10)', // Earned/Spent/Invested chips

  // ── Chart glow colours — on dark periwinkle card background ──────
  // Brighter variants of semantic colours so they glow on dark substrate
  chartIncome:     '#34D399',   // bright emerald glow on dark
  chartExpense:    '#FB7185',   // bright rose glow on dark
  chartDark:       '#252B78',   // dark chart card background = brand-dark
  chartGrid:       'rgba(255,255,255,0.06)', // grid lines on dark card
  chartCursor:     'rgba(255,255,255,0.06)', // tooltip cursor on dark card

  // ── Portfolio donut — periwinkle family, darkest → lightest ──────
  portfolio: [
    '#1F255F',
    '#4D59E8',
    '#7782FF',
    '#9AA5FF',
    '#EEF0FF',
    '#DDE2FF',
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#4D59E8',
  logoHighlight: '#E4FF5E',
}
