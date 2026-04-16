/** Material Design 3 (Pixel UI) smooth curves */
const MD3_EMPHASIZED_DECELERATE = [0.05, 0.7, 0.1, 1.0]
const MD3_STANDARD = [0.2, 0.0, 0.0, 1.0]

export function createFadeUp(y = 10, duration = 0.45) {
  return {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        ease: MD3_EMPHASIZED_DECELERATE,
      },
    },
  }
}

export function createStagger(staggerChildren = 0.05, delayChildren = 0.05) {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  }
}

// Pixel UI / Material 3 spring configs (snappier, less bouncy than standard spring)
export const SPRING_PREMIUM = { type: 'spring', stiffness: 500, damping: 40, mass: 1 }
export const SPRING_GENTLE = { type: 'spring', stiffness: 350, damping: 35, mass: 1 }

// Transition presets
export const transitionBase = { duration: 0.2, ease: MD3_STANDARD }
export const transitionEmphasis = { duration: 0.45, ease: MD3_EMPHASIZED_DECELERATE }
export const sheetEnterTransition = { type: 'spring', stiffness: 450, damping: 45 }
export const sheetExitTransition = { duration: 0.2, ease: MD3_STANDARD }
