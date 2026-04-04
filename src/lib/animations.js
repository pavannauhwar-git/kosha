/** CRED-style smooth deceleration curve — shared across all transitions */
const CRED_EASE = [0.22, 1, 0.36, 1]

export function createFadeUp(y = 10, duration = 0.4) {
  return {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        ease: CRED_EASE,
      },
    },
  }
}

export function createStagger(staggerChildren = 0.06, delayChildren = 0.04) {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  }
}

// Premium spring config for interactive elements
export const SPRING_PREMIUM = { type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }
export const SPRING_GENTLE = { type: 'spring', stiffness: 300, damping: 26, mass: 1 }

// Transition presets
export const transitionBase = { duration: 0.2, ease: CRED_EASE }
export const transitionEmphasis = { duration: 0.4, ease: CRED_EASE }
export const sheetEnterTransition = { type: 'spring', stiffness: 400, damping: 34 }
export const sheetExitTransition = { duration: 0.2, ease: CRED_EASE }
