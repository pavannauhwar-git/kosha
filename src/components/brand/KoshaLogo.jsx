import { C } from '../../lib/colors'

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
      <text
        x="32" y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Roboto, system-ui, sans-serif"
        fontSize="13"
        fontWeight="900"
        letterSpacing="1"
        fill="white"
      >
        KOSHA
      </text>
    </svg>
  )
}
