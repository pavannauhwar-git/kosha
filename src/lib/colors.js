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
  brand:           '#243BAF',
  brandMid:        '#3D5AFE',
  brandLight:      '#6C83FF',
  brandContainer:  '#E8EDFF',
  brandBorder:     '#C4CFFF',

  // ── Accent — Lime Yellow ─────────────────────────────────────────
  // Used ONLY against dark periwinkle backgrounds (hero card, logo).
  // Never use on white — fails contrast.
  accent:          '#F4FF00',
  accentBg:        'rgba(244,255,0,0.22)',
  accentFill:      'rgba(244,255,0,0.78)',

  // ── Income — Emerald H=174° ───────────────────────────────────────
  income:          '#059669',
  incomeText:      '#047857',

  // ── Expense — Rose H=354° ─────────────────────────────────────────
  expense:         '#E11D48',
  expenseBright:   '#E11D48',   // same — no separate "bright" needed

  // ── Investment — Sky Blue H=200° (MD3 Secondary) ───────────────────
  invest:          '#FF1DCE',   // custom investment accent
  investText:      '#7F2A52',   // darker text tone on light invest backgrounds

  saved:           '#243BAF',   // brand indigo — residual money in Kosha

  // ── Bills — Amber H=84° ───────────────────────────────────────────
  bills:           '#CA8A04',

  // ── Ink — indigo-tinted neutrals ─────────────────────────────────
  ink:             '#1F255F',
  inkMuted:        '#6E75A8',

  // ── Hero card overlays (lime/white on deep periwinkle) ────────────
  heroAccent:      'rgba(244,255,0,0.78)',
  heroAccentBg:    'rgba(244,255,0,0.22)',
  heroAccentSolid: '#F4FF00',
  heroLabel:       'rgba(255,255,255,0.82)', // "Total balance" label
  heroDimmer:      'rgba(255,255,255,0.35)', // "KOSHA" watermark
  heroDivider:     'rgba(255,255,255,0.12)', // horizontal rule
  heroStatBg:      'rgba(255,255,255,0.10)', // Earned/Spent/Invested chips

  // ── Chart glow colours — on dark periwinkle card background ──────
  // Brighter variants of semantic colours so they glow on dark substrate
  chartIncome:     '#34D399',   // bright emerald glow on dark
  chartExpense:    '#FB7185',   // bright rose glow on dark
  chartDark:       '#1B2D85',   // dark chart card background = brand-dark
  chartGrid:       'rgba(255,255,255,0.06)', // grid lines on dark card
  chartCursor:     'rgba(255,255,255,0.06)', // tooltip cursor on dark card

  // ── Portfolio donut — periwinkle family, darkest → lightest ──────
  portfolio: [
    '#1F255F',
    '#243BAF',
    '#3D5AFE',
    '#6C83FF',
    '#E8EDFF',
    '#C4CFFF',
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#243BAF',
  logoHighlight: '#F4FF00',
}
