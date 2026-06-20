import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export default function useWindowedList({
  count,
  estimateSize = 120,
  overscan = 8,
  enabled = true,
  resetKey = '',
  initialCount = 40,
}) {
  const containerRef = useRef(null)
  const sizeByIndexRef = useRef(new Map())
  const rafRef = useRef(0)
  const revisionRafRef = useRef(0)
  const [revision, setRevision] = useState(0)
  const [range, setRange] = useState(() => {
    const initialEnd = enabled ? Math.min(count, initialCount) : count
    return { start: 0, end: initialEnd }
  })

  const getSize = useCallback((index) => {
    const measured = sizeByIndexRef.current.get(index)
    if (Number.isFinite(measured) && measured > 0) return measured
    return typeof estimateSize === 'function' ? estimateSize(index) : estimateSize
  }, [estimateSize])

  const offsets = useMemo(() => {
    const list = new Array(count + 1)
    list[0] = revision ? 0 : 0
    for (let i = 0; i < count; i++) {
      list[i + 1] = list[i] + getSize(i)
    }
    return list
  }, [count, getSize, revision])

  const computeRange = useCallback(() => {
    if (!enabled || count <= 0) {
      setRange({ start: 0, end: count })
      return
    }

    const containerEl = containerRef.current
    if (!containerEl) {
      setRange((prev) => {
        const next = { start: 0, end: Math.min(count, Math.max(initialCount, overscan * 2)) }
        return prev.start === next.start && prev.end === next.end ? prev : next
      })
      return
    }

    const containerTop = containerEl.getBoundingClientRect().top + window.scrollY
    const viewportTop = Math.max(0, window.scrollY - containerTop)
    const viewportBottom = viewportTop + window.innerHeight

    // Binary search for startIndex
    let startIndex = 0
    let low = 0
    let high = count
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (offsets[mid] <= viewportTop) {
        startIndex = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    // Binary search for endIndex
    let endIndex = startIndex
    low = startIndex
    high = count
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (offsets[mid] <= viewportBottom) {
        endIndex = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    endIndex = Math.min(count, endIndex + 1)

    const nextStart = Math.max(0, startIndex - overscan)
    const nextEnd = Math.min(count, Math.max(nextStart, endIndex + overscan))

    setRange((prev) => {
      if (prev.start === nextStart && prev.end === nextEnd) return prev
      return { start: nextStart, end: nextEnd }
    })
  }, [count, enabled, initialCount, overscan, offsets])

  const scheduleComputeRange = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      computeRange()
    })
  }, [computeRange])

  useEffect(() => {
    scheduleComputeRange()

    window.addEventListener('scroll', scheduleComputeRange, { passive: true })
    window.addEventListener('resize', scheduleComputeRange)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      if (revisionRafRef.current) {
        cancelAnimationFrame(revisionRafRef.current)
        revisionRafRef.current = 0
      }
      window.removeEventListener('scroll', scheduleComputeRange)
      window.removeEventListener('resize', scheduleComputeRange)
    }
  }, [scheduleComputeRange])

  useEffect(() => {
    sizeByIndexRef.current.clear()
    if (revisionRafRef.current) {
      cancelAnimationFrame(revisionRafRef.current)
      revisionRafRef.current = 0
    }
    setRevision((value) => value + 1)
    setRange({
      start: 0,
      end: enabled ? Math.min(count, initialCount) : count,
    })
  }, [count, enabled, initialCount, resetKey])

  useEffect(() => {
    if (!enabled) return
    scheduleComputeRange()
  }, [enabled, revision, scheduleComputeRange])

  const measureElement = useCallback((index, node) => {
    if (!enabled || !node) return

    const height = Math.ceil(node.getBoundingClientRect().height)
    if (!Number.isFinite(height) || height <= 0) return

    const previous = sizeByIndexRef.current.get(index)
    if (previous && Math.abs(previous - height) < 1) return

    const estimated = typeof estimateSize === 'function' ? estimateSize(index) : estimateSize
    if (!previous && Math.abs(estimated - height) < 2) {
      sizeByIndexRef.current.set(index, height)
      return
    }

    sizeByIndexRef.current.set(index, height)
    
    if (!revisionRafRef.current) {
      revisionRafRef.current = requestAnimationFrame(() => {
        revisionRafRef.current = 0
        setRevision((value) => value + 1)
      })
    }
  }, [enabled, estimateSize])

  const totalSize = offsets[count]
  const topPadding = offsets[range.start]
  const renderedHeight = offsets[range.end] - offsets[range.start]

  const bottomPadding = useMemo(
    () => Math.max(0, totalSize - topPadding - renderedHeight),
    [renderedHeight, topPadding, totalSize]
  )

  const scrollToIndex = useCallback((index, options = {}) => {
    if (!Number.isFinite(index) || index < 0 || index >= count) return

    const containerEl = containerRef.current
    if (!containerEl) return

    const { behavior = 'smooth', block = 'center' } = options

    const containerTop = containerEl.getBoundingClientRect().top + window.scrollY
    const offset = offsets[index]
    const itemSize = getSize(index)

    let targetTop = containerTop + offset
    if (block === 'center') {
      targetTop -= Math.max(0, (window.innerHeight - itemSize) / 2)
    } else if (block === 'end') {
      targetTop -= Math.max(0, window.innerHeight - itemSize - 24)
    }

    window.scrollTo({ top: Math.max(0, targetTop), behavior })
  }, [count, offsets, getSize])

  return {
    containerRef,
    startIndex: range.start,
    endIndex: range.end,
    topPadding,
    bottomPadding,
    measureElement,
    scrollToIndex,
  }
}
