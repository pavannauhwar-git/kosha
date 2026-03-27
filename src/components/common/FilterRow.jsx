import { useRef, useState, useEffect } from "react"

export default function FilterRow({ children, className = '' }) {
  const ref = useRef(null)
  const [fadeRight, setFadeRight] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setFadeRight(el.scrollWidth > el.clientWidth + el.scrollLeft + 2)
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [])

  return (
    <div className={`relative ${className}`.trim()}>
      <div ref={ref} className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {children}
      </div>
      {fadeRight && (
        <div className="absolute top-0 right-0 bottom-0.5 w-6 pointer-events-none bg-gradient-to-l from-kosha-bg to-transparent" />
      )}
    </div>
  )
}
