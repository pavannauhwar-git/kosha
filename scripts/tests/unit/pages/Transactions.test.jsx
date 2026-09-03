import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Transactions from '../../../../src/pages/Transactions'
import { ToastProvider } from '../../../../src/context/ToastContext'

// --- Mocking Dependencies ---
vi.mock('../../../../src/hooks/useTransactions', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useTransactions: vi.fn(),
    useTransactionSignalAggregates: vi.fn(),
    useDebounce: vi.fn((val) => val),
  }
})

vi.mock('../../../../src/hooks/useAppMutation', () => ({
  useAppMutation: vi.fn(() => vi.fn()),
}))

vi.mock('../../../../src/lib/authStore', () => ({
  getAuthUserId: vi.fn(() => 'test-user-id'),
}))

vi.mock('../../../../src/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'test-user-id' }, profile: { display_name: 'Test User' } })),
}))

vi.mock('../../../../src/lib/walletStore', () => ({
  useActiveWallet: vi.fn(() => null),
}))

vi.mock('../../../../src/hooks/useUserCategories', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useUserCategories: vi.fn(() => ({ categories: [] })),
  }
})

vi.mock('../../../../src/lib/supabase', () => ({
  supabase: {}
}))

// Mock out the windowed list hook to render items directly
vi.mock('../../../../src/hooks/useWindowedList', () => ({
  default: vi.fn(),
}))

import { useTransactions, useTransactionSignalAggregates } from '../../../../src/hooks/useTransactions'
import useWindowedList from '../../../../src/hooks/useWindowedList'

describe('Transactions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTransactionSignalAggregates.mockReturnValue({ data: {} })
  })

  const renderComponent = () => {
    return render(
      <ToastProvider>
        <MemoryRouter>
          <Transactions />
        </MemoryRouter>
      </ToastProvider>
    )
  }

  it('renders loading skeleton when fetching', () => {
    useTransactions.mockReturnValue({
      data: [],
      total: 0,
      loading: true,
      fetching: false,
      refetch: vi.fn(),
    })
    
    // We mock windowed list to return empty during loading
    useWindowedList.mockReturnValue({
      containerRef: { current: null },
      visibleItems: [],
      totalHeight: 0,
      offsetY: 0,
      measureElement: vi.fn()
    })

    const { container } = renderComponent()
    
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    
    // Check that we aren't showing the empty state
    expect(screen.queryByText('No transactions found')).not.toBeInTheDocument()
  })

  it('renders empty state when there are no transactions and not loading', () => {
    useTransactions.mockReturnValue({
      data: [],
      total: 0,
      loading: false,
      fetching: false,
      refetch: vi.fn(),
    })

    useWindowedList.mockReturnValue({
      containerRef: { current: null },
      visibleItems: [],
      totalHeight: 0,
      offsetY: 0,
      measureElement: vi.fn()
    })

    const { container } = renderComponent()
    
    // The EmptyState component has this specific text based on typeFilter 'all'
    expect(screen.getByText('No transactions yet')).toBeInTheDocument()
    expect(screen.getByText("Start by adding your first transaction to build your timeline and insights.")).toBeInTheDocument()
  })

  it('renders transactions list when data is present', () => {
    const txns = [
      {
        id: 'txn-1',
        date: '2023-10-01',
        amount: 100,
        type: 'expense',
        description: 'Test Expense',
        category: 'food'
      }
    ]

    useTransactions.mockReturnValue({
      data: txns,
      total: 1,
      loading: false,
      fetching: false,
      refetch: vi.fn(),
    })

    // Mock the windowed list to pretend it's rendering the item
    useWindowedList.mockReturnValue({
      containerRef: { current: null },
      visibleItems: [
        { index: 0, item: txns[0], top: 0, isPlaceholder: false }
      ],
      totalHeight: 100,
      offsetY: 0,
      measureElement: vi.fn()
    })

    renderComponent()

    // TransactionItem should render the description
    expect(screen.getByText('Test Expense')).toBeInTheDocument()
  })
})
