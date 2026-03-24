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

  const { data, error } = await supabaseClient
    .from('invites')
    .insert({ created_by: userId })
    .select('id, token, created_at, used_by, used_at')
    .single()

  if (error) throw error
  return data
}

export async function listInvites({ supabaseClient, userId, limit = 8 }) {
  if (!supabaseClient) throw new Error('supabaseClient is required')
  if (!userId) return []

  const { data, error } = await supabaseClient
    .from('invites')
    .select('id, token, created_at, used_by, used_at')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export function buildJoinInviteUrl(token, origin = window?.location?.origin || '') {
  if (!token) return ''
  return `${origin}/join/${token}`
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

  const { data: invite, error: selectError } = await supabaseClient
    .from('invites')
    .select('id')
    .eq('token', inviteToken)
    .is('used_by', null)
    .single()

  if (selectError || !invite) {
    if (selectError?.code === 'PGRST116') {
      return { consumed: false, reason: 'invite-not-found-or-used' }
    }
    if (selectError) throw selectError
    return { consumed: false, reason: 'invite-not-found-or-used' }
  }

  const { error: updateError } = await supabaseClient
    .from('invites')
    .update({
      used_by: userId,
      used_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  if (updateError) throw updateError

  return { consumed: true, inviteId: invite.id }
}
