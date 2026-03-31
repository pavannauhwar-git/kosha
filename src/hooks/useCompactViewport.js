import { useEffect, useState } from 'react'

function matchesCompact(maxWidth) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(`(max-width: ${maxWidth}px)`).matches
}

export default function useCompactViewport(maxWidth = 640) {
  const [isCompact, setIsCompact] = useState(() => matchesCompact(maxWidth))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const media = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const onChange = (event) => setIsCompact(event.matches)

    setIsCompact(media.matches)

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    }

    media.addListener(onChange)
    return () => media.removeListener(onChange)
  }, [maxWidth])

  return isCompact
}
