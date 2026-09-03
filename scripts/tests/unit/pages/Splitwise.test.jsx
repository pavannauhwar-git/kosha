import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Splitwise from '../../../../src/pages/Splitwise'
import { ToastProvider } from '../../../../src/context/ToastContext'

// --- Mocking Dependencies ---
vi.mock('../../../../src/hooks/useSplitwise', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useSplitwise: vi.fn(),
  }
})

vi.mock('../../../../src/hooks/useAppMutation', () => ({
  useAppMutation: vi.fn(() => vi.fn()),
}))

vi.mock('../../../../src/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'test-user-id' }, profile: { display_name: 'Test User' } })),
}))

vi.mock('../../../../src/lib/authStore', () => ({
  getAuthUserId: vi.fn(() => 'test-user-id'),
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

import { useSplitwise } from '../../../../src/hooks/useSplitwise'

describe('Splitwise Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () => {
    return render(
      <ToastProvider>
        <MemoryRouter>
          <Splitwise />
        </MemoryRouter>
      </ToastProvider>
    )
  }

  it('renders loading skeleton when fetching', () => {
    useSplitwise.mockReturnValue({
      groups: [],
      members: [],
      groupAccessRows: [],
      expenses: [],
      settlements: [],
      balances: [],
      suggestedTransfers: [],
      loading: true,
      groupsLoading: true,
      error: null,
    })
    
    renderComponent()
    
    expect(screen.getByText('Splitwise')).toBeInTheDocument()
  })

  it('renders empty state when there are no groups', () => {
    useSplitwise.mockReturnValue({
      groups: [],
      members: [],
      groupAccessRows: [],
      expenses: [],
      settlements: [],
      balances: [],
      suggestedTransfers: [],
      loading: false,
      groupsLoading: false,
      error: null,
    })

    renderComponent()
    
    // The EmptyState component has this specific text based on groups
    expect(screen.getByText('No split group yet')).toBeInTheDocument()
    expect(screen.getByText("Create a group, invite Kosha users, and split expenses together.")).toBeInTheDocument()
  })

  it('renders groups list when data is present', () => {
    const groups = [
      {
        id: 'group-1',
        name: 'Goa Trip',
        is_archived: false
      }
    ]

    useSplitwise.mockReturnValue({
      groups,
      members: [],
      groupAccessRows: [],
      expenses: [],
      settlements: [],
      balances: [],
      suggestedTransfers: [],
      loading: false,
      groupsLoading: false,
      error: null,
    })

    renderComponent()

    expect(screen.getByText('Goa Trip')).toBeInTheDocument()
  })
})
