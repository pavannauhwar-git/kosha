import { useState } from 'react'

/**
 * Returns `true` on the first visit to a route in the current session,
 * `false` on subsequent visits. Used to conditionally apply entrance
 * animations so revisits don't re-fire "loading" animations.
 *
 * Persistence: sessionStorage — resets on tab close, not on PWA close.
 * (Reset-per-session, not per-PWA-launch, because a PWA "launch" from
 * the homescreen is the same UX surface as a tab open from a link.)
 */
export function useFirstRouteVisit(routeKey) {
  const [isFirst] = useState(() => {
    if (typeof sessionStorage === 'undefined') return true
    const storageKey = `kosha:visited:${routeKey}`
    try {
      if (sessionStorage.getItem(storageKey)) return false
      sessionStorage.setItem(storageKey, '1')
    } catch {
      // sessionStorage unavailable (e.g. Safari private mode) — always animate.
      return true
    }
    return true
  })
  return isFirst
}
