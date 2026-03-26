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

// M3-inspired motion presets for UI morphing.
// spatial: position/scale/shape movement
// effects: color/opacity state transitions
export const MOTION_SCHEMES = {
  standard: {
    spatial: { type: 'spring', stiffness: 340, damping: 30, mass: 0.82 },
    effects: { type: 'spring', stiffness: 420, damping: 36, mass: 0.72 },
  },
  expressive: {
    spatial: { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 },
    effects: { type: 'spring', stiffness: 390, damping: 32, mass: 0.7 },
  },
}

export function createMorphInteraction({
  scheme = 'standard',
  hoverY = -2,
  hoverScale = 1.01,
  hoverRadius = 20,
  tapScale = 0.985,
  tapRadius = 14,
} = {}) {
  const motion = MOTION_SCHEMES[scheme] || MOTION_SCHEMES.standard

  return {
    whileHover: { y: hoverY, scale: hoverScale, borderRadius: hoverRadius },
    whileTap: { y: 0, scale: tapScale, borderRadius: tapRadius },
    transition: motion.spatial,
  }
}
