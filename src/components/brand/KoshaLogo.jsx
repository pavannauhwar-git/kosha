export default function KoshaLogo({ size = 64, className = '' }) {
  return (
    <img
      src="/icons/icon-192.png"
      alt="Kosha logo"
      width={size}
      height={size}
      className={`block select-none ${className}`.trim()}
      decoding="async"
      draggable="false"
    />
  )
}
