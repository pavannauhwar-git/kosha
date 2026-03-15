/**
 * Kosha palette — JS constants
 *
 * This is the single source of truth for every colour used in
 * inline styles, Framer Motion animate props, recharts fill/stroke
 * props, SVG attributes, and Phosphor Icon color props.
 *
 * To change the palette:
 *   1. Edit the hex values here
 *   2. Update the matching CSS variables in src/index.css  (:root block)
 *   3. Update the matching tokens in tailwind.config.js
 *
 * Tailwind utility classes (text-brand, bg-income-bg, etc.) are
 * controlled by tailwind.config.js. Everything else flows from here.
 */

export const C = {

  // ── Brand (Forest Green) ──────────────────────────────────────────
  brand:           '#163300',   // buttons, FAB, active states
  brandLit:        '#9FE870',   // lime highlight — hero chip text, ring fill
  brandContainer:  '#C8F5A0',   // nav active pill, tonal button bg
  brandBorder:     '#D6ECC4',   // card borders, chart reference lines

  // ── Income / positive ─────────────────────────────────────────────
  income:          '#38A169',   // income bars, positive net, chart fill
  incomeText:      '#276749',   // income text amounts

  // ── Investment ────────────────────────────────────────────────────
  invest:          '#2B8A68',   // investment chart line
  investText:      '#1A5C45',   // investment amounts, donut arc

  // ── Expense / negative ────────────────────────────────────────────
  expense:         '#D42B3A',   // expense amounts, error states
  expenseBright:   '#FF4757',   // expense bars, negative cells, error icon

  // ── Bills / amber ─────────────────────────────────────────────────
  bills:           '#B35A00',   // bills quick-action icon

  // ── Ink / neutral ─────────────────────────────────────────────────
  inkMuted:        '#7A8F6E',   // inactive nav icons, chart axis ticks

  // ── Hero card overlays (white/lime on dark green) ─────────────────
  // These are intentionally semi-transparent so the dark bg shows through.
  heroAccent:      'rgba(159,232,112,0.75)',  // month label text on hero
  heroAccentBg:    'rgba(159,232,112,0.18)',  // savings rate chip bg on hero
  heroAccentSolid: '#9FE870',                // savings rate chip text on hero
  heroLabel:       'rgba(255,255,255,0.55)',  // "Total balance" label on hero
  heroDimmer:      'rgba(255,255,255,0.35)',  // "KOSHA" watermark on hero
  heroDivider:     'rgba(255,255,255,0.12)',  // horizontal rule on hero
  heroStatBg:      'rgba(255,255,255,0.10)',  // Earned/Spent/Invested chips bg on hero

  // ── Portfolio donut shades — darkest to lightest ──────────────────
  // Used in Analytics PortfolioDonut and the PORTFOLIO_COLORS array.
  portfolio: [
    '#163300',   // brand (darkest)
    '#2B8A68',   // invest
    '#38A169',   // income
    '#9FE870',   // brand-lit
    '#C8F5A0',   // brand-container
    '#D6ECC4',   // brand-border (lightest)
  ],

  // ── Logo SVG ──────────────────────────────────────────────────────
  // Used in KoshaLogo component in Login.jsx and Onboarding.jsx
  logoBg:      '#163300',   // rounded-rect fill
  logoHighlight: '#9FE870', // top-right ellipse glow
}
