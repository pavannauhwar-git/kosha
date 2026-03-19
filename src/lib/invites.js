export function getInviteToken(locationSearch = '') {
  const queryToken = new URLSearchParams(locationSearch || '').get('invite')
  if (queryToken) return queryToken

  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('pendingInviteToken')
  }

  return null
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
