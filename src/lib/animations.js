/**
 * Motion system — only the two factories actively used by the codebase.
 * All deprecated MD3 constants and variants were removed (dead code).
 */

// Used as default `ease` for createFadeUp
const EASE_STANDARD_DECELERATE = [0.0, 0.0, 0.0, 1.0]

// Default `duration` for createFadeUp (MD3 medium4 = 0.4s)
const DUR_MEDIUM4 = 0.4

/**
 * Page-level fade + slide variant.
 * @param {number} y  — translate offset in px
 * @param {number} duration — in seconds
 */
export function createFadeUp(y = 12, duration = DUR_MEDIUM4) {
  return {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1, y: 0,
      transition: { duration, ease: EASE_STANDARD_DECELERATE },
    },
  }
}

/**
 * Stagger parent variant — children animate sequentially.
 * @param {number} staggerChildren — delay between children (s)
 * @param {number} delayChildren — initial delay before first child (s)
 */
export function createStagger(staggerChildren = 0.05, delayChildren = 0.0) {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  }
}
