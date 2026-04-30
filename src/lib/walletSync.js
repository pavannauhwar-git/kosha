import { supabase } from './supabase'

/**
 * Fetches all user IDs that are linked to the current user via consumed invites.
 * Includes both users who joined via current user's links and users whose links
 * the current user joined.
 */
export async function fetchLinkedUserIds(userId) {
  if (!userId) return []

  // 1. Fetch invites created by me that were joined by someone else
  const { data: createdByMe, error: err1 } = await supabase
    .from('invites')
    .select('used_by')
    .eq('created_by', userId)
    .not('used_by', 'is', null)

  // 2. Fetch invites I joined that were created by someone else
  const { data: joinedByMe, error: err2 } = await supabase
    .from('invites')
    .select('created_by')
    .eq('used_by', userId)

  if (err1) throw err1
  if (err2) throw err2

  const ids = new Set()
  createdByMe?.forEach(row => ids.add(row.used_by))
  joinedByMe?.forEach(row => ids.add(row.created_by))

  return Array.from(ids)
}

/**
 * Fetches profile information for all linked users.
 */
export async function fetchLinkedProfiles(userId) {
  const linkedIds = await fetchLinkedUserIds(userId)
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
 */
export async function unlinkPartner(currentUserId, targetUserId) {
  if (!currentUserId || !targetUserId) throw new Error('Both currentUserId and targetUserId are required.')

  // Delete where I created and they used
  const { error: err1 } = await supabase
    .from('invites')
    .delete()
    .eq('created_by', currentUserId)
    .eq('used_by', targetUserId)

  // Delete where they created and I used
  const { error: err2 } = await supabase
    .from('invites')
    .delete()
    .eq('created_by', targetUserId)
    .eq('used_by', currentUserId)

  if (err1) throw err1
  if (err2) throw err2

  return true
}
