import { useRef, useCallback, useEffect } from 'react'
import {
  removeTransactionMutation,
  optimisticallyDeleteTransactionFromCache,
  optimisticallyUpsertTransactionInCache,
} from './useTransactions'
import { useAppMutation } from './useAppMutation'
import { useAppToast } from '../context/ToastContext'
import { readLocalStorage } from '../lib/safeStorage'

const DELETE_UNDO_WINDOW_MS = 4200

function shouldCommitDeleteImmediately() {
  if (typeof window === 'undefined') return false
  const webdriver = typeof navigator !== 'undefined' && navigator.webdriver
  const cypress = typeof window.Cypress !== 'undefined'
  const forced = readLocalStorage('kosha:e2e-immediate-delete', '0') === '1'
  return Boolean(webdriver || cypress || forced)
}

export function useTransactionDeleter(activeWalletUserId, data) {
  const { pushToast } = useAppToast()
  const pendingDeleteRef = useRef(null)
  
  const removeTransaction = useAppMutation(removeTransactionMutation, { context: 'transactions:delete' })
  const commitRemoveTransaction = useAppMutation(removeTransactionMutation, { context: 'transactions:deleteCommit' })

  const commitPendingDelete = useCallback(async (pendingDelete) => {
    if (!pendingDelete?.id) return
    try {
      await commitRemoveTransaction.mutateAsync(pendingDelete.id)
    } catch (e) {
      if (pendingDelete.txn) {
        optimisticallyUpsertTransactionInCache(pendingDelete.txn, activeWalletUserId)
      }
      pushToast(e.message || 'Could not delete transaction.', { duration: 4200 })
    }
  }, [activeWalletUserId, pushToast, commitRemoveTransaction])

  useEffect(() => {
    return () => {
      const pendingDelete = pendingDeleteRef.current
      if (!pendingDelete) return
      if (pendingDelete.timeoutId) {
        clearTimeout(pendingDelete.timeoutId)
      }
      pendingDeleteRef.current = null
      void commitPendingDelete(pendingDelete)
    }
  }, [commitPendingDelete])

  const handleDelete = useCallback(async (id) => {
    if (!id) return false

    const pendingDelete = pendingDeleteRef.current
    if (pendingDelete?.id && pendingDelete.id !== id) {
      if (pendingDelete.timeoutId) {
        clearTimeout(pendingDelete.timeoutId)
      }
      pendingDeleteRef.current = null
      void commitPendingDelete(pendingDelete)
    }

    const txn = data.find((row) => row?.id === id)
    if (!txn) {
      try {
        await removeTransaction.mutateAsync(id)
        return true
      } catch (e) {
        pushToast(e.message || 'Could not delete transaction.', { duration: 4200 })
        throw e
      }
    }

    const snapshot = { ...txn }
    optimisticallyDeleteTransactionFromCache(id, activeWalletUserId)

    if (shouldCommitDeleteImmediately()) {
      await commitPendingDelete({ id, txn: snapshot, timeoutId: null })
      return true
    }

    const undoDelete = () => {
      const pending = pendingDeleteRef.current
      if (!pending || pending.id !== id) return
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId)
      }
      pendingDeleteRef.current = null
      optimisticallyUpsertTransactionInCache(pending.txn, activeWalletUserId)
      pushToast('Deletion canceled.', { duration: 2200 })
    }

    const timeoutId = setTimeout(() => {
      const pending = pendingDeleteRef.current
      if (!pending || pending.id !== id) return
      pendingDeleteRef.current = null
      void commitPendingDelete(pending)
    }, DELETE_UNDO_WINDOW_MS)

    pendingDeleteRef.current = { id, txn: snapshot, timeoutId }

    pushToast('Transaction deleted.', {
      action: undoDelete,
      actionLabel: 'Undo',
      duration: DELETE_UNDO_WINDOW_MS,
    })

    return undefined
  }, [data, activeWalletUserId, commitPendingDelete, pushToast, removeTransaction])

  return { handleDelete }
}
