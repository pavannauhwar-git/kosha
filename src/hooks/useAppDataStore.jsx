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

  const clearOptimisticTxns = useCallback(() => {
    setOptimisticTxns([])
  }, [])

  const value = {
    optimisticTxns,
    addOptimisticTxn,
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

