// The status bar takes the colour of whatever is directly under it: the top bar
// (--ds-surface) while one is on screen, otherwise the page (--ds-surface-dim).
// Counted rather than a boolean because during a route change the next page's
// top bar mounts before the previous one unmounts.
let topBarCount = 0

export function applyThemeColor() {
  if (typeof document === 'undefined') return
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  const token = topBarCount > 0 ? '--ds-surface' : '--ds-surface-dim'
  const color = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  if (color) meta.setAttribute('content', color)
}

/** Call from a top bar's mount effect; returns the cleanup for unmount. */
export function trackTopBar() {
  topBarCount += 1
  applyThemeColor()
  return () => {
    topBarCount = Math.max(0, topBarCount - 1)
    applyThemeColor()
  }
}
