import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useTransactionDeleter } from '../../../../src/hooks/useTransactionDeleter'
import * as ToastContext from '../../../../src/context/ToastContext'
import * as UseAppMutation from '../../../../src/hooks/useAppMutation'
import * as UseTransactions from '../../../../src/hooks/useTransactions'

vi.mock('../../../../src/context/ToastContext', () => ({
  useAppToast: vi.fn(),
}))

vi.mock('../../../../src/hooks/useAppMutation', () => ({
  useAppMutation: vi.fn(),
}))

vi.mock('../../../../src/hooks/useTransactions', () => ({
  optimisticallyDeleteTransactionFromCache: vi.fn(),
  optimisticallyUpsertTransactionInCache: vi.fn(),
  removeTransactionMutation: vi.fn(),
}))

describe('useTransactionDeleter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('undos a pending delete and does not call mutateAsync', async () => {
    let pushedToastAction = null
    ToastContext.useAppToast.mockReturnValue({
      pushToast: vi.fn((msg, opts) => {
        if (opts?.action) pushedToastAction = opts.action
      }),
    })

    const mutateAsyncSpy = vi.fn()
    UseAppMutation.useAppMutation.mockReturnValue({
      mutateAsync: mutateAsyncSpy,
    })

    const data = [{ id: 'txn-1' }]
    const { result, rerender } = renderHook(() => useTransactionDeleter('wallet-1', data))

    // 1. Delete
    await act(async () => {
      result.current.handleDelete('txn-1')
    })
    
    expect(UseTransactions.optimisticallyDeleteTransactionFromCache).toHaveBeenCalledWith('txn-1', 'wallet-1')
    expect(mutateAsyncSpy).not.toHaveBeenCalled()

    // 2. Force re-render
    rerender()

    // 3. Undo
    act(() => {
      if (pushedToastAction) pushedToastAction()
    })

    expect(UseTransactions.optimisticallyUpsertTransactionInCache).toHaveBeenCalledWith(data[0], 'wallet-1')
    
    // 4. Advance time
    act(() => {
      vi.runAllTimers()
    })

    // Mutate should never have been called
    expect(mutateAsyncSpy).not.toHaveBeenCalled()
  })
})
