import { createContext, useContext, useState, useCallback } from 'react'

const AppDataContext = createContext(null)

export function AppDataProvider({ children }) {
  // Transient in-flight optimistic state — not persisted to localStorage.
  // On app restart the fresh fetch brings the correct server data.
  const [optimisticTxns, setOptimisticTxns] = useState([])
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState([])

  // Full transaction data for deleted items — lets summary/balance hooks
  // subtract the right amounts before the server confirms the delete.
  const [optimisticDeletedTxns, setOptimisticDeletedTxns] = useState([])

  // Optimistic edits — { id, original: {...}, updated: {...} } entries
  // let summary/balance hooks compute deltas for in-flight edits.
  const [optimisticEdits, setOptimisticEdits] = useState([])

  const addOptimisticTxn = useCallback((payload, optimisticId) => {
    const id = optimisticId || '__optimistic__' + Date.now() + Math.random().toString(16).slice(2)
    const withMeta = {
      ...payload,
      _id: id,
    }
    setOptimisticTxns(prev => [...prev, withMeta])
    return id
  }, [])

  const addOptimisticDelete = useCallback((id, txnData) => {
    if (!id) return
    setOptimisticDeletedIds(prev => (prev.includes(id) ? prev : [...prev, id]))
    if (txnData) {
      setOptimisticDeletedTxns(prev =>
        prev.some(t => t.id === id) ? prev : [...prev, { ...txnData, id }]
      )
    }
  }, [])

  const removeOptimisticDelete = useCallback((id) => {
    if (!id) return
    setOptimisticDeletedIds(prev => prev.filter(x => x !== id))
    setOptimisticDeletedTxns(prev => prev.filter(t => t.id !== id))
  }, [])

  const pruneOptimisticDeletes = useCallback((serverRows = []) => {
    if (!Array.isArray(serverRows)) return
    const serverIds = new Set(serverRows.map(r => r.id))
    setOptimisticDeletedIds(prev => prev.filter(id => serverIds.has(id)))
    setOptimisticDeletedTxns(prev => prev.filter(t => serverIds.has(t.id)))
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

  const resolveOptimisticTxn = useCallback((optimisticId) => {
    if (!optimisticId) return
    // Remove the optimistic entry entirely. Once the server confirms and
    // addTransaction() calls invalidateCache(), the refetch brings the real row.
    setOptimisticTxns(prev => prev.filter(t => (t._id || t.id) !== optimisticId))
  }, [])

  const removeOptimisticTxn = useCallback((id) => {
    if (!id) return
    setOptimisticTxns(prev => prev.filter(t => (t._id || t.id) !== id))
  }, [])

  const addOptimisticEdit = useCallback((id, original, updated) => {
    if (!id) return
    setOptimisticEdits(prev => {
      const filtered = prev.filter(e => e.id !== id)
      return [...filtered, { id, original, updated }]
    })
  }, [])

  const removeOptimisticEdit = useCallback((id) => {
    if (!id) return
    setOptimisticEdits(prev => prev.filter(e => e.id !== id))
  }, [])

  const clearOptimisticEdits = useCallback(() => {
    setOptimisticEdits([])
  }, [])

  const value = {
    optimisticTxns,
    addOptimisticTxn,
    pruneOptimisticTxns,
    removeOptimisticTxn,
    resolveOptimisticTxn,
    optimisticDeletedIds,
    optimisticDeletedTxns,
    addOptimisticDelete,
    removeOptimisticDelete,
    pruneOptimisticDeletes,
    optimisticEdits,
    addOptimisticEdit,
    removeOptimisticEdit,
    clearOptimisticEdits,
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
