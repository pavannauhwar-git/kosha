import { describe, it, expect } from 'vitest'
import { walletInviteReasonMessage } from '../../../../src/lib/invites'

describe('walletInviteReasonMessage', () => {
  it.each([
    ['invite-expired', 'This invite link has expired. Ask your partner for a new one.'],
    ['invite-not-found-or-used', 'This invite link has already been used or no longer exists.'],
    ['cannot-consume-own-invite', 'This is your own invite link. Send it to your partner to link wallets.'],
  ])('explains %s', (reason, message) => {
    expect(walletInviteReasonMessage(reason)).toBe(message)
  })

  it('mentions the 1:1 partner model when either side is already linked', () => {
    expect(walletInviteReasonMessage('already-linked')).toMatch('1:1 partner model')
  })

  it('falls back to a generic message for unknown reasons', () => {
    expect(walletInviteReasonMessage('something-new')).toBe('Could not join this wallet. Please try again.')
    expect(walletInviteReasonMessage(undefined)).toBe('Could not join this wallet. Please try again.')
  })
})
