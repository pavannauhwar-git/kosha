import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

function sumRange(getSize, start, endExclusive) {
  let total = 0
  for (let i = start; i < endExclusive; i += 1) {
    total += getSize(i)
  }
  return total
}

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
  const [revision, setRevision] = useState(0)
  const [range, setRange] = useState(() => {
    const initialEnd = enabled ? Math.min(count, initialCount) : count
    return { start: 0, end: initialEnd }
  })

  const getSize = useCallback((index) => {
    const measured = sizeByIndexRef.current.get(index)
    if (Number.isFinite(measured) && measured > 0) return measured
    return estimateSize
  }, [estimateSize])

  const getOffsetForIndex = useCallback((index) => {
    if (index <= 0) return 0
    return sumRange(getSize, 0, index)
  }, [getSize])

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

    let runningOffset = 0
    let startIndex = 0

    while (startIndex < count) {
      const nextOffset = runningOffset + getSize(startIndex)
      if (nextOffset >= viewportTop) break
      runningOffset = nextOffset
      startIndex += 1
    }

    let endIndex = startIndex
    let endOffset = runningOffset

    while (endIndex < count && endOffset <= viewportBottom) {
      endOffset += getSize(endIndex)
      endIndex += 1
    }

    const nextStart = Math.max(0, startIndex - overscan)
    const nextEnd = Math.min(count, Math.max(nextStart, endIndex + overscan))

    setRange((prev) => {
      if (prev.start === nextStart && prev.end === nextEnd) return prev
      return { start: nextStart, end: nextEnd }
    })
  }, [count, enabled, getSize, initialCount, overscan])

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
      window.removeEventListener('scroll', scheduleComputeRange)
      window.removeEventListener('resize', scheduleComputeRange)
    }
  }, [scheduleComputeRange])

  useEffect(() => {
    sizeByIndexRef.current.clear()
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

    sizeByIndexRef.current.set(index, height)
    setRevision((value) => value + 1)
  }, [enabled])

  const totalSize = useMemo(
    () => sumRange(getSize, 0, count),
    [count, getSize, revision]
  )

  const topPadding = useMemo(
    () => sumRange(getSize, 0, range.start),
    [getSize, range.start, revision]
  )

  const renderedHeight = useMemo(
    () => sumRange(getSize, range.start, range.end),
    [getSize, range.start, range.end, revision]
  )

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
    const offset = getOffsetForIndex(index)
    const itemSize = getSize(index)

    let targetTop = containerTop + offset
    if (block === 'center') {
      targetTop -= Math.max(0, (window.innerHeight - itemSize) / 2)
    } else if (block === 'end') {
      targetTop -= Math.max(0, window.innerHeight - itemSize - 24)
    }

    window.scrollTo({ top: Math.max(0, targetTop), behavior })
  }, [count, getOffsetForIndex, getSize])

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
