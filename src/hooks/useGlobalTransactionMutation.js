import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addTransaction } from './useTransactions'
import { useCallback } from 'react'

export function useGlobalTransactionMutation() {
  const queryClient = useQueryClient()

  const onTransactionSaved = useCallback((payload) => {
      // optimistic update handling now goes entirely inside components via useMutation, 
      // mapping legacy API to query client invalidation directly
  }, [])
  const onTransactionConfirmed = useCallback((serverTxn) => {
     queryClient.invalidateQueries({ queryKey: ['transactions'] })
     queryClient.invalidateQueries({ queryKey: ['month'] })
     queryClient.invalidateQueries({ queryKey: ['year'] })
     queryClient.invalidateQueries({ queryKey: ['balance'] })
  }, [queryClient])
  const onTransactionFailed = useCallback(() => {
     queryClient.invalidateQueries({ queryKey: ['transactions'] })
  }, [queryClient])

  return { onTransactionSaved, onTransactionConfirmed, onTransactionFailed }
}
