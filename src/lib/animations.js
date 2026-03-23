export function createFadeUp(y = 6, duration = 0.18) {
  return {
    hidden: { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: { duration, ease: 'easeOut' } },
  }
}

export function createStagger(staggerChildren = 0.05, delayChildren = 0.04) {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  }
}
