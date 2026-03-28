import { motion } from 'framer-motion'

export default function Mascot({ type, className = '', style = {} }) {
  const getAvatar = () => {
    switch (type) {
      case 'cat':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-lg" style={{ overflow: 'visible' }}>
            <motion.g animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}>
              <path d="M20,60 Q50,20 80,60 Q80,95 50,95 Q20,95 20,60 Z" fill="#312E81"/>
              <polygon points="15,60 5,20 40,40" fill="#312E81"/>
              <polygon points="85,60 95,20 60,40" fill="#312E81"/>
              <ellipse cx="35" cy="65" rx="14" ry="18" fill="#7FFF00"/>
              <ellipse cx="65" cy="65" rx="14" ry="18" fill="#7FFF00"/>
              <ellipse cx="35" cy="65" rx="4" ry="12" fill="#0F172A"/>
              <ellipse cx="65" cy="65" rx="4" ry="12" fill="#0F172A"/>
              <path d="M45,80 Q50,85 55,80" stroke="#7FFF00" strokeWidth="2" strokeLinecap="round" fill="none"/>
            </motion.g>
          </svg>
        )
      case 'peek':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl" style={{ overflow: 'visible' }}>
            <motion.g animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>
              <path d="M15,100 L15,40 Q50,10 85,40 L85,100 Z" fill="#6D28D9"/>
              <circle cx="35" cy="55" r="16" fill="#fff"/>
              <circle cx="65" cy="55" r="16" fill="#fff"/>
              <circle cx="35" cy="55" r="6" fill="#312E81"/>
              <circle cx="65" cy="55" r="6" fill="#312E81"/>
              <path d="M45,75 Q50,70 55,75" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none"/>
              <motion.g
                animate={{ rotate: [0, 20, 0, 20, 0] }}
                transition={{ repeat: Infinity, duration: 2.5, repeatDelay: 0.5 }}
                style={{ transformOrigin: '85px 85px' }}
              >
                <path d="M80,85 Q110,65 115,85 Q125,100 85,105 Z" fill="#6D28D9"/>
                <circle cx="108" cy="78" r="6" fill="#5B21B6"/>
                <circle cx="116" cy="85" r="6" fill="#5B21B6"/>
                <circle cx="112" cy="95" r="6" fill="#5B21B6"/>
              </motion.g>
            </motion.g>
          </svg>
        )
      case 'bot': // Swipe indicator
        return (
          <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-lg" style={{ overflow: 'visible' }}>
            <motion.g animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>
              <rect x="50" y="30" width="50" height="45" rx="12" fill="#4F46E5"/>
              <line x1="75" y1="30" x2="75" y2="10" stroke="#CBD5E1" strokeWidth="4"/>
              <circle cx="75" cy="10" r="6" fill="#7FFF00">
                <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
              </circle>
              <circle cx="65" cy="50" r="8" fill="#fff"/>
              <circle cx="85" cy="50" r="8" fill="#fff"/>
              <circle cx="61" cy="50" r="3" fill="#0F172A"/>
              <circle cx="81" cy="50" r="3" fill="#0F172A"/>
              <motion.g animate={{ x: [-10, -25, -10] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}>
                <path d="M40,55 L20,55 M30,45 L20,55 L30,65" stroke="#7FFF00" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </motion.g>
            </motion.g>
          </svg>
        )
      case 'sleepy':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-lg" style={{ overflow: 'visible' }}>
            <motion.g animate={{ scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }} style={{ transformOrigin: '50% 80%' }}>
              <path d="M 5,85 Q 50,30 95,85 Z" fill="#818CF8"/>
              <path d="M 30,70 Q 35,75 40,70" stroke="#312E81" strokeWidth="4" fill="none" strokeLinecap="round"/>
              <path d="M 60,70 Q 65,75 70,70" stroke="#312E81" strokeWidth="4" fill="none" strokeLinecap="round"/>
              <circle cx="50" cy="80" r="3" fill="#312E81"/>
              <motion.g animate={{ opacity: [0, 1, 0], y: [0, -10, -20], x: [0, 5, 10] }} transition={{ repeat: Infinity, duration: 3, delay: 0 }}>
                <text x="60" y="45" fill="#7FFF00" fontSize="18" fontWeight="bold">Z</text>
              </motion.g>
              <motion.g animate={{ opacity: [0, 1, 0], y: [0, -10, -20], x: [0, 5, 10] }} transition={{ repeat: Infinity, duration: 3, delay: 1 }}>
                <text x="75" y="30" fill="#7FFF00" fontSize="14" fontWeight="bold">Z</text>
              </motion.g>
              <motion.g animate={{ opacity: [0, 1, 0], y: [0, -10, -20], x: [0, 5, 10] }} transition={{ repeat: Infinity, duration: 3, delay: 2 }}>
                <text x="85" y="20" fill="#7FFF00" fontSize="10" fontWeight="bold">z</text>
              </motion.g>
            </motion.g>
          </svg>
        )
      case 'owl':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-lg" style={{ overflow: 'visible' }}>
            <motion.g animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>
              <rect x="20" y="25" width="60" height="70" rx="30" fill="#312E81"/>
              <motion.g animate={{ scaleY: [1, 0.1, 1], y: [0, 25, 0] }} transition={{ repeat: Infinity, duration: 5, times: [0, 0.05, 0.1], repeatDelay: 4 }}>
                <circle cx="35" cy="50" r="18" fill="#fff"/>
                <circle cx="65" cy="50" r="18" fill="#fff"/>
                <circle cx="35" cy="50" r="8" fill="#7FFF00"/>
                <circle cx="65" cy="50" r="8" fill="#7FFF00"/>
                <circle cx="35" cy="50" r="4" fill="#0F172A"/>
                <circle cx="65" cy="50" r="4" fill="#0F172A"/>
              </motion.g>
              <polygon points="45,62 55,62 50,72" fill="#F59E0B"/>
              <polygon points="10,35 50,20 90,35 50,50" fill="#7FFF00" opacity="0.9"/>
              <rect x="47" y="50" width="6" height="10" fill="#7FFF00"/>
            </motion.g>
          </svg>
        )
      case 'detective':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-lg" style={{ overflow: 'visible' }}>
            <motion.g animate={{ rotate: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
              <path d="M 20,80 Q 50,10 80,80 Z" fill="#5B21B6"/>
              <circle cx="45" cy="55" r="8" fill="#fff"/>
              <circle cx="45" cy="55" r="3" fill="#000"/>
              <motion.g animate={{ rotate: [-10, 15, -10], x: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }} style={{ transformOrigin: '70px 60px' }}>
                <circle cx="65" cy="50" r="18" fill="rgba(127,255,0,0.3)" stroke="#7FFF00" strokeWidth="4"/>
                <line x1="78" y1="63" x2="95" y2="80" stroke="#7FFF00" strokeWidth="6" strokeLinecap="round"/>
                <circle cx="60" cy="50" r="5" fill="#fff"/>
                <circle cx="60" cy="50" r="2" fill="#000"/>
              </motion.g>
            </motion.g>
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className={`relative ${className}`} style={{ ...style, pointerEvents: 'none' }}>
      {getAvatar()}
    </div>
  )
}