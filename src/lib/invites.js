// The database enforces this cap (a BEFORE INSERT trigger on public.invites).
// The UI uses it only for the listInvites() limit and helper text.
export const MAX_ACTIVE_INVITES = 1

export const PENDING_WALLET_INVITE_KEY = 'pendingInviteToken'
export const PENDING_SPLIT_INVITE_KEY = 'pendingSplitGroupInviteToken'
const PENDING_INVITE_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function savePendingInvite(key, token) {
  if (!token) return
  const value = JSON.stringify({ token, savedAt: Date.now() })
  try { sessionStorage.setItem(key, value) } catch { /* private mode */ }
  try { localStorage.setItem(key, value) } catch { /* private mode */ }
}

export function readPendingInvite(key) {
  let raw = null
  try { raw = sessionStorage.getItem(key) } catch { raw = null }
  if (!raw) {
    try { raw = localStorage.getItem(key) } catch { raw = null }
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.token) {
      if (Date.now() - Number(parsed.savedAt || 0) > PENDING_INVITE_MAX_AGE_MS) {
        clearPendingInvite(key)
        return null
      }
      return String(parsed.token)
    }
  } catch { /* legacy raw string */ }
  return String(raw)
}

export function clearPendingInvite(key) {
  try { sessionStorage.removeItem(key) } catch { /* private mode */ }
  try { localStorage.removeItem(key) } catch { /* private mode */ }
}

export function clearAllPendingInvites() {
  clearPendingInvite(PENDING_WALLET_INVITE_KEY)
  clearPendingInvite(PENDING_SPLIT_INVITE_KEY)
}

export function resolvePostAuthPath(fallback = '/') {
  if (readPendingInvite(PENDING_WALLET_INVITE_KEY)) return '/join'
  if (readPendingInvite(PENDING_SPLIT_INVITE_KEY)) return '/splitwise'
  return fallback
}

export function getInviteToken(locationSearch = '') {
  const queryToken = new URLSearchParams(locationSearch || '').get('invite')
  if (queryToken) return queryToken

  return readPendingInvite(PENDING_WALLET_INVITE_KEY)
}

export async function createInvite({ supabaseClient, userId }) {
  if (!supabaseClient) throw new Error('supabaseClient is required')
  if (!userId) throw new Error('userId is required')

  const { data, error } = await supabaseClient
    .from('invites')
    .insert({ created_by: userId })
    .select('id, token, created_at, used_by, used_at, expires_at')
    .single()

  if (error) {
    // Two server-side codepaths report the same condition:
    //   1. The BEFORE INSERT trigger raises P0001 with message
    //      'invite_limit_reached' on the friendly path.
    //   2. The partial unique index `uniq_invites_active_per_user` raises
    //      23505 (unique_violation) when two concurrent inserts both pass
    //      the trigger check. The index name is in the error message.
    // Both translate to the same user-facing message so the UX is
    // identical to the old single-source-of-truth client check.
    const message = String(error.message || '')
    const code = String(error.code || '')
    const isLimitError =
      message.includes('invite_limit_reached') ||
      code === '23505' ||
      message.includes('uniq_invites_active_per_user')
    if (isLimitError) {
      throw new Error(`Invite limit reached. You can keep only ${MAX_ACTIVE_INVITES} active links.`)
    }
    throw error
  }
  return data
}

export async function listInvites({ supabaseClient, userId, limit = MAX_ACTIVE_INVITES }) {
  if (!supabaseClient) throw new Error('supabaseClient is required')
  if (!userId) return []

  const safeLimit = Math.max(1, Math.min(Number(limit || 10), 50))

  const { data, error } = await supabaseClient
    .from('invites')
    .select('id, token, created_at, used_by, used_at, expires_at')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) throw error
  return data || []
}

export function buildJoinInviteUrl(token, origin = undefined) {
  if (!token) return ''
  const resolvedOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${resolvedOrigin}/join/${token}`
}

export function maskInviteUrl(token, origin = undefined) {
  if (!token) return ''
  const resolvedOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${resolvedOrigin}/join/••••••${String(token).slice(-4)}`
}

export function inviteStatusLabel(inviteRow) {
  if (inviteRow?.used_by && inviteRow?.used_at) return 'Joined'
  if (inviteRow?.expires_at && new Date(inviteRow.expires_at) <= new Date()) return 'Expired'
  return 'Pending'
}

const WALLET_INVITE_REASON_MESSAGES = {
  'unauthenticated': 'Sign in to accept this invitation.',
  'missing-token-or-user': 'This invite link is incomplete. Ask your partner to send it again.',
  'invite-not-found-or-used': 'This invite link has already been used or no longer exists.',
  'invite-expired': 'This invite link has expired. Ask your partner for a new one.',
  'cannot-consume-own-invite': 'This is your own invite link. Send it to your partner to link wallets.',
  'already-linked': 'You or the invite creator are already linked to a wallet partner. Kosha supports a strict 1:1 partner model.',
}

export function walletInviteReasonMessage(reason) {
  return WALLET_INVITE_REASON_MESSAGES[reason] || 'Could not join this wallet. Please try again.'
}

export async function consumeInviteToken({ supabaseClient, inviteToken, userId }) {
  if (!supabaseClient) throw new Error('supabaseClient is required')
  if (!inviteToken || !userId) {
    return { consumed: false, reason: 'missing-token-or-user' }
  }

  const { data, error } = await supabaseClient.rpc('consume_wallet_invite', {
    p_token: inviteToken
  })

  if (error) {
    console.error('[Kosha] consume_wallet_invite error:', error)
    throw error
  }

  if (!data?.consumed) {
    return { consumed: false, reason: data?.reason || 'invite-not-found-or-used' }
  }

  return { consumed: true, inviteId: data.inviteId }
}

export async function deleteInvite({ supabaseClient, inviteId }) {
  if (!supabaseClient) throw new Error('supabaseClient is required')
  if (!inviteId) throw new Error('inviteId is required')

  const { error, count } = await supabaseClient
    .from('invites')
    .delete({ count: 'exact' })
    .eq('id', inviteId)

  if (error) {
    console.error('[Kosha] deleteInvite database error:', error)
    throw new Error(`Database error: ${error.message}`)
  }

  if (count === 0) {
    console.warn('[Kosha] deleteInvite: 0 rows affected. Likely RLS policy violation.')
    throw new Error('Permission denied. You can only remove links you created or that are joined to your account.')
  }

  return true
}
