import { createContext, useContext, useState, useCallback } from 'react'

const AppDataContext = createContext(null)

export function AppDataProvider({ children }) {
  const [optimisticTxns, setOptimisticTxns] = useState([])

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

