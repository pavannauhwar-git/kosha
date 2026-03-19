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

    const serverIds = new Set(serverRows.map(r => r.id))
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
    setOptimisticTxns(prev => prev.filter(t => {
      const id = t._id || t.id
      if (id && serverIds.has(id)) return false
      return !serverKeys.has(keyOf(t))
    }))
  }, [])

  const resolveOptimisticTxn = useCallback((optimisticId, serverTxn) => {
    if (!optimisticId) return
    // Swap temporary optimistic ID with the confirmed server row so the UI stays
    // stable even if the immediate refetch returns stale data. The canonical
    // transaction list will prune this entry once the same server row appears.
    setOptimisticTxns(prev => prev.map((t) => {
      if ((t._id || t.id) !== optimisticId) return t
      if (!serverTxn?.id) return t
      return {
        ...t,
        ...serverTxn,
        _id: serverTxn.id,
      }
    }))
  }, [])

  const pruneOptimisticEdits = useCallback((serverRows = []) => {
    if (!Array.isArray(serverRows) || serverRows.length === 0) return
    const byId = new Map(serverRows.map(r => [r.id, r]))
    setOptimisticEdits(prev => prev.filter(({ id, updated }) => {
      const row = byId.get(id)
      if (!row) return true
      const entries = Object.entries(updated || {}).filter(([k]) => k !== '_original')
      if (!entries.length) return false
      return entries.some(([k, v]) => row[k] !== v)
    }))
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
    pruneOptimisticEdits,
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
