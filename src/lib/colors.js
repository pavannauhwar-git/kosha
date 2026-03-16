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

  // ── Brand — Periwinkle ────────────────────────────────────────────
  brand:           '#3730A3',   // deep indigo — buttons, FAB, active states
  brandMid:        '#5B51E0',   // mid periwinkle — hero gradient end
  brandLight:      '#8B83E6',   // lighter periwinkle
  brandContainer:  '#EDE9FF',   // lavender tint — nav pill, tonal bg
  brandBorder:     '#D4CEFF',   // card borders, separators

  // ── Accent — Electric Lime ────────────────────────────────────────
  // Used ONLY against dark periwinkle backgrounds (hero card, logo).
  // Never use on white — fails contrast.
  accent:          '#E2FF5A',   // electric lime text/fill on dark bg
  accentBg:        'rgba(226,255,90,0.20)',  // lime tint chip bg on hero
  accentFill:      'rgba(226,255,90,0.75)',  // savings bar fill on hero

  // ── Income — Emerald H=174° ───────────────────────────────────────
  income:          '#059669',
  incomeText:      '#047857',

  // ── Expense — Rose H=354° ─────────────────────────────────────────
  expense:         '#E11D48',
  expenseBright:   '#E11D48',   // same — no separate "bright" needed

  // ── Investment — Cyan H=194° ──────────────────────────────────────
  invest:          '#BE185D',   // deep rose-pink, darker H=331°
  investText:      '#9D174D',

  saved:           '#3730A3',   // brand periwinkle — residual money in Kosha

  // ── Bills — Amber H=84° ───────────────────────────────────────────
  bills:           '#CA8A04',

  // ── Ink — indigo-tinted neutrals ─────────────────────────────────
  ink:             '#1E1B4B',
  inkMuted:        '#9590B8',   // inactive nav icons, chart axis ticks

  // ── Hero card overlays (lime/white on deep periwinkle) ────────────
  heroAccent:      'rgba(226,255,90,0.75)',   // savings bar fill
  heroAccentBg:    'rgba(226,255,90,0.20)',   // chip bg
  heroAccentSolid: '#E2FF5A',                // chip text, month label
  heroLabel:       'rgba(255,255,255,0.55)', // "Total balance" label
  heroDimmer:      'rgba(255,255,255,0.35)', // "KOSHA" watermark
  heroDivider:     'rgba(255,255,255,0.12)', // horizontal rule
  heroStatBg:      'rgba(255,255,255,0.10)', // Earned/Spent/Invested chips

  // ── Chart glow colours — on dark #1E1B4B card background ─────────
  // Brighter variants of semantic colours so they glow on dark substrate
  chartIncome:     '#34D399',   // bright emerald glow on dark
  chartExpense:    '#FB7185',   // bright rose glow on dark
  chartDark:       '#1E1B4B',   // dark chart card background = brand ink
  chartGrid:       'rgba(255,255,255,0.06)', // grid lines on dark card
  chartCursor:     'rgba(255,255,255,0.06)', // tooltip cursor on dark card

  // ── Portfolio donut — periwinkle family, darkest → lightest ──────
  portfolio: [
    '#1E1B4B',   // ink (darkest)
    '#3730A3',   // brand
    '#5B51E0',   // brand-mid
    '#8B83E6',   // brand-light
    '#EDE9FF',   // brand-container
    '#D4CEFF',   // brand-border (lightest)
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#3730A3',   // deep indigo rounded-rect fill
  logoHighlight: '#E2FF5A',   // electric lime top-right glow
}
