export function createFadeUp(y = 6, duration = 0.14) {
  return {
    hidden: { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: { duration, ease: 'easeOut' } },
  }
}

export function createStagger(staggerChildren = 0.035, delayChildren = 0.02) {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  }
}
