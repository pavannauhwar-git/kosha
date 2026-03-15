import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Dashboard    from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Monthly      from './pages/Monthly'
import Analytics    from './pages/Analytics'
import Bills        from './pages/Bills'
import { House, List, CalendarDots, ChartBar, Receipt } from '@phosphor-icons/react'

const NAV = [
  { path: '/',             label: 'Home',     Icon: House        },
  { path: '/transactions', label: 'All',      Icon: List         },
  { path: '/monthly',      label: 'Monthly',  Icon: CalendarDots },
  { path: '/analytics',    label: 'Insights', Icon: ChartBar     },
  { path: '/bills',        label: 'Bills',    Icon: Receipt      },
]

// Opacity-only fade — no x/y translation, no mode="wait".
// mode="wait" caused a dead pause between pages (exit must finish before
// enter starts). Removing it means crossfade — instant and smooth.
// 120ms enter, 80ms exit — fast enough to feel snappy on mobile.
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.08, ease: 'easeIn'  } },
}

function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const active   = NAV.findIndex(n =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
  )

  return (
    <div className="nav-float-wrap">
      <nav className="nav-float">
        {NAV.map((item, i) => {
          const isActive = i === active
          return (
            <button
              key={item.path}
              className="nav-float-item"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8)
                navigate(item.path)
              }}
            >
              <div className="relative flex items-center justify-center w-14 h-11">
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-pill"
                    style={{ background: '#EEEBFF' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                  />
                )}
                <item.Icon
                  size={26}
                  weight={isActive ? 'fill' : 'regular'}
                  color={isActive ? '#6C47FF' : '#A09CC0'}
                  style={{ position: 'relative', zIndex: 1 }}
                />
              </div>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function PageTransition({ children }) {
  const location = useLocation()
  return (
    <AnimatePresence>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ willChange: 'opacity' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-dvh bg-kosha-bg">
        <Routes>
          <Route path="/"             element={<PageTransition><Dashboard    /></PageTransition>} />
          <Route path="/transactions" element={<PageTransition><Transactions /></PageTransition>} />
          <Route path="/monthly"      element={<PageTransition><Monthly      /></PageTransition>} />
          <Route path="/analytics"    element={<PageTransition><Analytics    /></PageTransition>} />
          <Route path="/bills"        element={<PageTransition><Bills        /></PageTransition>} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
