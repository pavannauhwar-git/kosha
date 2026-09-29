import { useCallback } from 'react'
import {
  removeTransactionMutation,
  optimisticallyDeleteTransactionFromCache,
  optimisticallyUpsertTransactionInCache,
} from './useTransactions'
import { useAppMutation } from './useAppMutation'
import { useAppToast } from '../context/ToastContext'
import { readLocalStorage } from '../lib/safeStorage'
import { useUndoableDelete } from './useUndoableDelete'

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
  const { mutateAsync: removeNow } = useAppMutation(removeTransactionMutation, { context: 'transactions:delete' })
  const { mutateAsync: commitDelete } = useAppMutation(removeTransactionMutation, { context: 'transactions:deleteCommit' })

  const { schedule, undo } = useUndoableDelete({
    commit: (id) => commitDelete(id),
    restore: ({ txn, walletUserId }) => optimisticallyUpsertTransactionInCache(txn, walletUserId),
    onError: (e) => pushToast(e.message || 'Could not delete transaction.', { duration: 4200 }),
    windowMs: DELETE_UNDO_WINDOW_MS,
  })

  const handleDelete = useCallback(async (id) => {
    if (!id) return false
    const txn = data.find((row) => row?.id === id)

    if (!txn || shouldCommitDeleteImmediately()) {
      try {
        await removeNow(id)
        return true
      } catch (e) {
        pushToast(e.message || 'Could not delete transaction.', { duration: 4200 })
        throw e
      }
    }

    optimisticallyDeleteTransactionFromCache(id, activeWalletUserId)
    schedule(id, { txn: { ...txn }, walletUserId: activeWalletUserId })
    pushToast('Transaction deleted.', {
      action: () => { if (undo(id)) pushToast('Deletion canceled.', { duration: 2200 }) },
      actionLabel: 'Undo',
      duration: DELETE_UNDO_WINDOW_MS,
    })
    return undefined
  }, [data, activeWalletUserId, removeNow, schedule, undo, pushToast])

  return { handleDelete }
}
