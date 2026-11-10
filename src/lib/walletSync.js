import { supabase } from './supabase.js'

/**
 * Fetches all user IDs that are linked to the current user via consumed invites.
 * Includes both users who joined via current user's links and users whose links
 * the current user joined.
 */
export async function fetchLinkedUserIds(userId) {
  if (!userId) return []

  const { data, error } = await supabase
    .from('invites')
    .select('created_by, used_by')
    .or(`created_by.eq.${userId},used_by.eq.${userId}`)
    .not('used_by', 'is', null)

  if (error) throw error

  const ids = new Set()
  for (const row of data || []) {
    const other = row.created_by === userId ? row.used_by : row.created_by
    if (other && other !== userId) ids.add(other)
  }
  return Array.from(ids)
}

/**
 * Fetches profile information for all linked users. Pass `linkedIds` when
 * they are already known to skip a second invites lookup.
 */
export async function fetchLinkedProfiles(userId, linkedIds) {
  if (!linkedIds) linkedIds = await fetchLinkedUserIds(userId)
  if (linkedIds.length === 0) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', linkedIds)

  if (error) throw error
  return data || []
}

/**
 * Removes the linkage between the current user and a target partner.
 *
 * Migration 004: this now calls a SECURITY DEFINER RPC that deletes both
 * invite directions in a single SQL statement (inside a single Postgres
 * transaction). The previous implementation issued TWO separate DELETEs
 * — if the second one failed (network, RLS, anything) we were left
 * half-unlinked: one direction gone, the other still active.
 *
 * `currentUserId` is intentionally ignored — auth.uid() on the server is
 * authoritative. The parameter is kept in the signature for backward
 * compatibility with existing call sites.
 */
export async function unlinkPartner(currentUserId, targetUserId) {
  if (!currentUserId || !targetUserId) throw new Error('Both currentUserId and targetUserId are required.')

  const { error } = await supabase.rpc('unlink_partner_atomic', { p_partner_id: targetUserId })
  if (error) throw error
  return true
}
