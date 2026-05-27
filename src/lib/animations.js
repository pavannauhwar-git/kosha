/**
 * Material Design 3 (MD3) Strict Motion System
 *
 * This system implements the official MD3 easing curves and durations
 * for predictable, grounded motion. Custom physics-based springs and
 * scale bouncing are deliberately omitted in favor of standard UI motion.
 */

// ─── MD3 Easing Curves ───────────────────────────────────────────────────────
export const EASE_EMPHASIZED            = [0.2, 0.0, 0.0, 1.0]  // Expressive, large moves
export const EASE_EMPHASIZED_DECELERATE = [0.05, 0.7, 0.1, 1.0] // Expressive entering
export const EASE_EMPHASIZED_ACCELERATE = [0.3, 0.0, 0.8, 0.15] // Expressive exiting
export const EASE_STANDARD              = [0.2, 0.0, 0.0, 1.0]  // Simple persistent changes
export const EASE_STANDARD_DECELERATE   = [0.0, 0.0, 0.0, 1.0]  // Simple entering
export const EASE_STANDARD_ACCELERATE   = [0.3, 0.0, 1.0, 1.0]  // Simple exiting

// ─── MD3 Durations (in seconds for Framer Motion) ───────────────────────────
export const DUR_SHORT1  = 0.05
export const DUR_SHORT2  = 0.1
export const DUR_SHORT3  = 0.15
export const DUR_SHORT4  = 0.2
export const DUR_MEDIUM1 = 0.25
export const DUR_MEDIUM2 = 0.3
export const DUR_MEDIUM3 = 0.35
export const DUR_MEDIUM4 = 0.4
export const DUR_LONG1   = 0.45
export const DUR_LONG2   = 0.5

// ─── Core Transitions ────────────────────────────────────────────────────────
export const transitionStandard       = { duration: DUR_MEDIUM2, ease: EASE_STANDARD }
export const transitionEmphasized     = { duration: DUR_LONG2,   ease: EASE_EMPHASIZED }
export const transitionEnter          = { duration: DUR_MEDIUM4, ease: EASE_STANDARD_DECELERATE }
export const transitionExit           = { duration: DUR_SHORT4,  ease: EASE_STANDARD_ACCELERATE }

export const sheetEnterTransition     = { duration: DUR_LONG2,   ease: EASE_EMPHASIZED }
export const sheetExitTransition      = { duration: DUR_SHORT4,  ease: EASE_STANDARD_ACCELERATE }

// ─── Page-level variants (No scaling, only opacity & translate) ──────────────
export function createFadeUp(y = 12, duration = DUR_MEDIUM4) {
  return {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1, y: 0,
      transition: { duration, ease: EASE_STANDARD_DECELERATE },
    },
  }
}

export function createFadeIn(duration = DUR_MEDIUM2) {
  return {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: { duration, ease: EASE_STANDARD_DECELERATE } },
  }
}

// Replaces createSpringUp - uses strict MD3 enter
export function createSpringUp(y = 16) {
  return createFadeUp(y, DUR_MEDIUM4)
}

export function createStagger(staggerChildren = 0.05, delayChildren = 0.0) {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  }
}

// ─── Interactive state variants (Deprecated scale logic) ─────────────────────
// NOTE: Scaling transforms are discouraged in MD3. Use CSS `.md3-state-overlay` 
// and `.md3-elevation-shift` instead. These are kept for backwards compat but do nothing.
export const tapVariants = {
  rest:    { scale: 1 },
  hover:   { scale: 1 },
  pressed: { scale: 1 },
}

export const chipVariants = {
  rest:    { scale: 1 },
  hover:   { scale: 1 },
  pressed: { scale: 1 },
}

// ─── Morphing sheet enter ────────────────────────────────────────────────────
export const sheetVariants = {
  hidden: { y: '100%', opacity: 0 },
  show: {
    y: 0, opacity: 1,
    transition: sheetEnterTransition,
  },
  exit: {
    y: '100%', opacity: 0,
    transition: sheetExitTransition,
  },
}
