import { C } from '../../lib/colors'

export default function KoshaLogo({ size = 64 }) {
  const r = Math.round(size * 0.22)
  const fontSize = Math.round(size * 0.28)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx={r} fill={C.brand} />
      <text
        x="32" y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'InterVariable', 'Inter', system-ui, sans-serif"
        fontSize={fontSize}
        fontWeight="900"
        letterSpacing="2.5"
        fill="#FFFFFF"
      >
        KOSHA
      </text>
    </svg>
  )
}
