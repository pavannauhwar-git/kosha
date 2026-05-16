import { useState, useEffect, useRef } from 'react'
import { motion, useSpring, useTransform, animate } from 'framer-motion'

/**
 * A premium rolling number component that handles financial formatting.
 * Uses spring physics for a high-end feel.
 */
export default function AnimatedNumber({ value, formatter = (v) => v, className = '' }) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef(value)

  useEffect(() => {
    const controls = animate(prevValueRef.current, value, {
      duration: 0.8,
      ease: [0.34, 1.56, 0.64, 1], // Custom spring-like cubic bezier
      onUpdate: (latest) => {
        setDisplayValue(latest)
      },
    })
    prevValueRef.current = value
    return () => controls.stop()
  }, [value])

  return (
    <motion.span className={className}>
      {formatter(displayValue)}
    </motion.span>
  )
}
