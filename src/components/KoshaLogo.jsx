import { C } from '../lib/colors'

export default function KoshaLogo({ size = 64 }) {
  const r = Math.round(size * 0.22)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="kosha-hero-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={C.brand} />
          <stop offset="100%" stopColor={C.brandMid} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx={r} fill="url(#kosha-hero-grad)" />

      {/* Geometric K mark — two diagonal strokes meeting a vertical stem */}
      {/* Vertical stem */}
      <rect x="20" y="16" width="5.5" height="32" rx="2.75" fill="white" />

      {/* Horizontal divider line */}
      <rect x="14" y="29.5" width="36" height="5" rx="2.5" fill="white" opacity="0.35" />

      {/* Upper diagonal — top-right stroke */}
      <rect x="26" y="15" width="5.5" height="21" rx="2.75" fill="white"
        transform="rotate(35 28.75 25.5)" />

      {/* Lower diagonal — bottom-right stroke */}
      <rect x="26" y="28" width="5.5" height="21" rx="2.75" fill="white"
        transform="rotate(-35 28.75 38.5)" />
    </svg>
  )
}
