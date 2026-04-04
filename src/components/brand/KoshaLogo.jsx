import { C } from '../../lib/colors'

export default function KoshaLogo({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="14" fill={C.brand} />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'InterVariable', 'Inter', system-ui, sans-serif"
        fontSize="15"
        fontWeight="900"
        lengthAdjust="spacingAndGlyphs"
        textLength="46"
        fill="#FFFFFF"
      >
        KOSHA
      </text>
    </svg>
  )
}
