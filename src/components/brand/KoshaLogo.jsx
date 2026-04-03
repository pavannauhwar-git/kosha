import { C } from '../../lib/colors'

export default function KoshaLogo({ size = 64 }) {
  const r = Math.round(size * 0.22)
  const fontSize = Math.round(size * 0.24)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx={r} fill={C.brand} />
      <text
        x="33.5" y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'InterVariable', 'Inter', system-ui, sans-serif"
        fontSize={fontSize}
        fontWeight="900"
        letterSpacing="3"
        fill="#FFFFFF"
      >
        KOSHA
      </text>
    </svg>
  )
}
