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

  // ── Brand — Modern Indigo ────────────────────────────────────────
  brand:           '#4F46E5',
  brandMid:        '#6366F1',
  brandLight:      '#818CF8',
  brandContainer:  '#E0E7FF',
  brandBorder:     '#E2E8F0',

  // ── Accent — Indigo Light Accent ─────────────────────────────────
  accent:          '#818CF8',
  accentBg:        'rgba(129,140,248,0.22)',
  accentFill:      'rgba(129,140,248,0.78)',

  // ── Contrast — Electric Lime ─────────────────────────────────────
  lime:            '#CAFF04',
  limeMuted:       '#D4FF3D',
  limeDark:        '#9ACC00',
  limeBg:          'rgba(202,255,4,0.12)',
  limeOnDark:      '#CAFF04',

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
  heroAccent:      'rgba(129,140,248,0.78)',
  heroAccentBg:    'rgba(129,140,248,0.22)',
  heroAccentSolid: '#818CF8',
  heroLabel:       'rgba(255,255,255,0.65)',
  heroDimmer:      'rgba(255,255,255,0.35)',
  heroDivider:     'rgba(255,255,255,0.15)',
  heroStatBg:      'rgba(255,255,255,0.15)',

  // ── Chart glow colours ───────────────────────────────────────────
  chartIncome:     '#34D399',
  chartExpense:    '#FB7185',
  chartDark:       '#3730A3',
  chartGrid:       'rgba(255,255,255,0.06)',
  chartCursor:     'rgba(255,255,255,0.06)',

  // ── Portfolio donut — indigo family, darkest → lightest ──────────
  portfolio: [
    '#312E81',
    '#3730A3',
    '#4F46E5',
    '#6366F1',
    '#818CF8',
    '#A5B4FC',
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  logoBg:        '#4F46E5',
  logoHighlight: '#818CF8',
}
