import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AppDataContext = createContext(null)
const OPT_KEY = 'kosha_optimistic_txns'

export function AppDataProvider({ children }) {
  const [optimisticTxns, setOptimisticTxns] = useState(() => {
    try {
      const raw = localStorage.getItem(OPT_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      if (!optimisticTxns.length) {
        localStorage.removeItem(OPT_KEY)
      } else {
        localStorage.setItem(OPT_KEY, JSON.stringify(optimisticTxns))
      }
    } catch {
      // ignore storage errors
    }
  }, [optimisticTxns])

  const addOptimisticTxn = useCallback((payload) => {
    const withMeta = {
      ...payload,
      _id: '__optimistic__' + Date.now() + Math.random().toString(16).slice(2),
    }
    setOptimisticTxns(prev => [...prev, withMeta])
  }, [])

  const pruneOptimisticTxns = useCallback((serverRows = []) => {
    if (!Array.isArray(serverRows) || serverRows.length === 0) return

    const normDesc = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
    const keyOf = (t) => [
      t.date,
      t.type,
      Number(t.amount) || 0,
      normDesc(t.description),
      t.category || '',
      t.investment_vehicle || '',
      t.payment_mode || '',
      Boolean(t.is_repayment),
    ].join('|')

    const serverKeys = new Set(serverRows.map(keyOf))
    setOptimisticTxns(prev => prev.filter(t => !serverKeys.has(keyOf(t))))
  }, [])

  const clearOptimisticTxns = useCallback(() => {
    setOptimisticTxns([])
  }, [])

  const value = {
    optimisticTxns,
    addOptimisticTxn,
    pruneOptimisticTxns,
    clearOptimisticTxns,
  }

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}

