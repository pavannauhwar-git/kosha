export const C = {

  // ── Brand — Periwinkle Violet ────────────────────────────────────
  brand:           '#4B0082',
  brandMid:        '#7928CA',
  brandLight:      '#A855F7',
  brandContainer:  '#EDE5F8',
  brandBorder:     '#D4C0EA',

  // ── Accent — Lime Yellow ─────────────────────────────────────────
  // Used ONLY against dark periwinkle backgrounds (hero card, logo).
  // Never use on white — fails contrast.
  accent:          '#CCFF00',
  accentBg:        'rgba(204,255,0,0.22)',
  accentFill:      'rgba(204,255,0,0.85)',

  // ── Income — Emerald H=174° ───────────────────────────────────────
  income:          '#059669',
  incomeText:      '#047857',

  // ── Expense — Rose H=354° ─────────────────────────────────────────
  expense:         '#E11D48',
  expenseBright:   '#E11D48',

  // ── Investment — Sky Blue H=200° (MD3 Secondary) ───────────────────
  invest:          '#0284C7',   // custom investment accent
  investText:      '#0369A1',   // darker text tone on light invest backgrounds

  saved:           '#4B0082', 

  // ── Bills — Amber H=84° ───────────────────────────────────────────
  bills:           '#CA8A04',

  // ── Ink — indigo-tinted neutrals ─────────────────────────────────
  ink:             '#1E1533',
  inkMuted:        '#756496',

  // ── Hero card overlays (lime/white on deep periwinkle) ────────────
  heroAccent:      'rgba(204,255,0,0.85)',
  heroAccentBg:    'rgba(204,255,0,0.22)',
  heroAccentSolid: '#CCFF00',
  heroLabel:       'rgba(255,255,255,0.55)', // "Total balance" label
  heroDimmer:      'rgba(255,255,255,0.35)', // "KOSHA" watermark
  heroDivider:     'rgba(255,255,255,0.12)', // horizontal rule
  heroStatBg:      'rgba(255,255,255,0.10)', // Earned/Spent/Invested chips

  // ── Chart glow colours — on dark periwinkle card background ──────
  // Brighter variants of semantic colours so they glow on dark substrate
  chartIncome:     '#34D399',   // bright emerald glow on dark
  chartExpense:    '#FB7185',   // bright rose glow on dark
  chartDark:       '#2D0060',   // dark chart card background = brand-dark
  chartGrid:       'rgba(255,255,255,0.06)', // grid lines on dark card
  chartCursor:     'rgba(255,255,255,0.06)', // tooltip cursor on dark card

  // ── Portfolio donut — periwinkle family, darkest → lightest ──────
  portfolio: [
    '#1E1553',
    '#4B0082',
    '#7928CA',
    '#A855F7',
    '#EDE5F8',
    '#D4C0EA',
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#4B0082',
  logoHighlight: '#CCFF00',
}
