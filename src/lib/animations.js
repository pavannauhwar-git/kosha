export const MOTION = Object.freeze({
  durations: Object.freeze({
    fast: 0.09,
    base: 0.14,
    emphasis: 0.22,
  }),
  easing: Object.freeze({
    standard: [0.22, 1, 0.36, 1],
  }),
  spring: Object.freeze({
    nav: Object.freeze({ type: 'spring', stiffness: 520, damping: 36, mass: 0.8 }),
    navTap: Object.freeze({ type: 'spring', stiffness: 640, damping: 32, mass: 0.74 }),
    sheet: Object.freeze({ type: 'spring', stiffness: 420, damping: 36, mass: 0.82 }),
  }),
  tapScale: 0.97,
})

export const transitionFast = {
  duration: MOTION.durations.fast,
  ease: MOTION.easing.standard,
}

export const transitionBase = {
  duration: MOTION.durations.base,
  ease: MOTION.easing.standard,
}

export const transitionEmphasis = {
  duration: MOTION.durations.emphasis,
  ease: MOTION.easing.standard,
}

export const sheetEnterTransition = MOTION.spring.sheet
export const sheetExitTransition = transitionEmphasis

export function createFadeUp(y = 6, duration = MOTION.durations.base) {
  return {
    hidden: { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: { duration, ease: MOTION.easing.standard } },
  }
}

export function createStagger(staggerChildren = 0.035, delayChildren = 0.02) {
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren,
        delayChildren,
        when: 'beforeChildren',
      },
    },
  }
}
