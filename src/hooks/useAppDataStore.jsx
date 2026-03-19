import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AppDataContext = createContext(null)
const OPT_KEY = 'kosha_optimistic_txns'
const OPT_DEL_KEY = 'kosha_optimistic_deleted_txn_ids'

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

  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(OPT_DEL_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  // Full transaction data for deleted items — lets summary/balance hooks
  // subtract the right amounts before the server confirms the delete.
  const [optimisticDeletedTxns, setOptimisticDeletedTxns] = useState([])

  // Optimistic edits — { id, original: {...}, updated: {...} } entries
  // let summary/balance hooks compute deltas for in-flight edits.
  const [optimisticEdits, setOptimisticEdits] = useState([])

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

  useEffect(() => {
    try {
      if (!optimisticDeletedIds.length) {
        localStorage.removeItem(OPT_DEL_KEY)
      } else {
        localStorage.setItem(OPT_DEL_KEY, JSON.stringify(optimisticDeletedIds))
      }
    } catch {
      // ignore storage errors
    }
  }, [optimisticDeletedIds])

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

  const resolveOptimisticTxn = useCallback((optimisticId, serverTxn) => {
    if (!optimisticId) return
    setOptimisticTxns(prev => {
      let found = false
      const replaced = prev.map((t) => {
        const id = t._id || t.id
        if (id === optimisticId) {
          found = true
          return serverTxn ? { ...serverTxn } : t
        }
        return t
      })
      return found ? replaced : prev
    })
  }, [])

  const removeOptimisticTxn = useCallback((id) => {
    if (!id) return
    setOptimisticTxns(prev => prev.filter(t => (t._id || t.id) !== id))
  }, [])

  const clearOptimisticTxns = useCallback(() => {
    setOptimisticTxns([])
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
    clearOptimisticTxns,
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
