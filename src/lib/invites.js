export const MAX_ACTIVE_INVITES = 1

export function getInviteToken(locationSearch = '') {
  const queryToken = new URLSearchParams(locationSearch || '').get('invite')
  if (queryToken) return queryToken

  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('pendingInviteToken')
  }

  return null
}

export async function createInvite({ supabaseClient, userId }) {
  if (!supabaseClient) throw new Error('supabaseClient is required')
  if (!userId) throw new Error('userId is required')

  const { count, error: countError } = await supabaseClient
    .from('invites')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId)
    .is('used_by', null)

  if (countError) throw countError
  if ((count || 0) >= MAX_ACTIVE_INVITES) {
    throw new Error(`Invite limit reached. You can keep only ${MAX_ACTIVE_INVITES} active links.`)
  }

  const { data, error } = await supabaseClient
    .from('invites')
    .insert({ created_by: userId })
    .select('id, token, created_at, used_by, used_at')
    .single()

  if (error) throw error
  return data
}

export async function listInvites({ supabaseClient, userId, limit = MAX_ACTIVE_INVITES }) {
  if (!supabaseClient) throw new Error('supabaseClient is required')
  if (!userId) return []

  const safeLimit = Math.max(1, Math.min(Number(limit || 10), 50))

  const { data, error } = await supabaseClient
    .from('invites')
    .select('id, token, created_at, used_by, used_at')
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

export function inviteStatusLabel(inviteRow) {
  if (inviteRow?.used_by && inviteRow?.used_at) return 'Joined'
  return 'Pending'
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
