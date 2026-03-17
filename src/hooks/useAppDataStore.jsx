import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AppDataContext = createContext(null)
const OPT_KEY = 'kosha_optimistic_txns'
const OPT_DEL_KEY = 'kosha_optimistic_deleted_txn_ids'
const OPT_DEL_TXN_KEY = 'kosha_optimistic_deleted_txns'
const OPT_EDIT_KEY = 'kosha_optimistic_edited_txns'

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

  const [optimisticDeletedTxns, setOptimisticDeletedTxns] = useState(() => {
    try {
      const raw = localStorage.getItem(OPT_DEL_TXN_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  })

  const [optimisticEdits, setOptimisticEdits] = useState(() => {
    try {
      const raw = localStorage.getItem(OPT_EDIT_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
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

  useEffect(() => {
    try {
      const keys = Object.keys(optimisticDeletedTxns || {})
      if (!keys.length) {
        localStorage.removeItem(OPT_DEL_TXN_KEY)
      } else {
        localStorage.setItem(OPT_DEL_TXN_KEY, JSON.stringify(optimisticDeletedTxns))
      }
    } catch {
      // ignore storage errors
    }
  }, [optimisticDeletedTxns])

  useEffect(() => {
    try {
      const keys = Object.keys(optimisticEdits || {})
      if (!keys.length) {
        localStorage.removeItem(OPT_EDIT_KEY)
      } else {
        localStorage.setItem(OPT_EDIT_KEY, JSON.stringify(optimisticEdits))
      }
    } catch {
      // ignore storage errors
    }
  }, [optimisticEdits])

  const addOptimisticTxn = useCallback((payload) => {
    const withMeta = {
      ...payload,
      _id: '__optimistic__' + Date.now() + Math.random().toString(16).slice(2),
    }
    setOptimisticTxns(prev => [...prev, withMeta])
  }, [])

  const addOptimisticDelete = useCallback((txnOrId) => {
    const id = typeof txnOrId === 'object' ? txnOrId?.id : txnOrId
    if (!id) return
    setOptimisticDeletedIds(prev => (prev.includes(id) ? prev : [...prev, id]))
    if (txnOrId && typeof txnOrId === 'object') {
      setOptimisticDeletedTxns(prev => ({ ...prev, [id]: txnOrId }))
    }
  }, [])

  const removeOptimisticDelete = useCallback((id) => {
    if (!id) return
    setOptimisticDeletedIds(prev => prev.filter(x => x !== id))
    setOptimisticDeletedTxns(prev => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const pruneOptimisticDeletes = useCallback((serverRows = []) => {
    if (!Array.isArray(serverRows)) return
    const serverIds = new Set(serverRows.map(r => r.id))
    setOptimisticDeletedIds(prev => prev.filter(id => serverIds.has(id)))
    setOptimisticDeletedTxns(prev =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => serverIds.has(id)))
    )
  }, [])

  const addOptimisticEdit = useCallback((id, updates, original) => {
    if (!id || !updates) return
    setOptimisticEdits(prev => ({
      ...prev,
      [id]: {
        updates,
        original: original || prev[id]?.original || null,
      },
    }))
  }, [])

  const removeOptimisticEdit = useCallback((id) => {
    if (!id) return
    setOptimisticEdits(prev => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
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
    optimisticDeletedIds,
    optimisticDeletedTxns,
    addOptimisticDelete,
    removeOptimisticDelete,
    pruneOptimisticDeletes,
    optimisticEdits,
    addOptimisticEdit,
    removeOptimisticEdit,
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
