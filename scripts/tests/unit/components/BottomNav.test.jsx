import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}))

vi.mock('framer-motion', () => {
  const plain = (Tag) => function Plain(props) {
    const rest = { ...props }
    for (const key of ['layoutId', 'initial', 'animate', 'transition']) delete rest[key]
    return <Tag {...rest} />
  }
  return { motion: { div: plain('div'), span: plain('span') } }
})

vi.mock('../../../../src/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ loading: false, user: { id: 'test-user-id' } })),
}))

// No active wallet, so tapping a tab never starts a data prefetch.
vi.mock('../../../../src/lib/walletStore', () => ({
  useActiveWallet: vi.fn(() => null),
}))

vi.mock('../../../../src/components/app/AppRoutes', () => ({
  ROUTE_PRELOADERS: {},
}))

vi.mock('../../../../src/lib/haptics', () => ({
  hapticTap: vi.fn(),
}))

import { BottomNav } from '../../../../src/components/app/Navigation'

const renderNav = () => render(
  <MemoryRouter initialEntries={['/']}>
    <BottomNav />
  </MemoryRouter>
)

describe('BottomNav', () => {
  beforeEach(() => {
    navigate.mockClear()
  })

  it('navigates once when a tap fires both pointer-up and click', () => {
    renderNav()
    const tab = screen.getByRole('button', { name: 'Activity' })
    fireEvent.pointerUp(tab)
    fireEvent.click(tab)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/transactions', { replace: true })
  })

  it('navigates on pointer-up when Safari swallows the click', () => {
    renderNav()
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Monthly' }))
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/monthly', { replace: true })
  })

  it('navigates on a click alone, as from the keyboard', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: 'Insights' }))
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/analytics', { replace: true })
  })

  it('ignores a finger lifted outside the tab', () => {
    renderNav()
    const tab = screen.getByRole('button', { name: 'Splitwise' })
    tab.getBoundingClientRect = () => ({ left: 0, right: 40, top: 0, bottom: 40, width: 40, height: 40, x: 0, y: 0 })
    fireEvent.pointerUp(tab, { clientX: 120, clientY: 20 })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('ignores a right-click', () => {
    renderNav()
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Obligations' }), { pointerType: 'mouse', button: 2 })
    expect(navigate).not.toHaveBeenCalled()
  })
})
