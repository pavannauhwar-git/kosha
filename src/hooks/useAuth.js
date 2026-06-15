import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { queryClient } from '../lib/queryClient.js'
import { setAuthUser, clearAuthUser, getAuthUserId } from '../lib/authStore.js'
import { setErrorReportingUser, clearErrorReportingUser } from '../lib/errorReporting.js'
import { initActiveWallet } from '../lib/walletStore.js'
import { fetchLinkedUserIds, fetchLinkedProfiles } from '../lib/walletSync.js'
import { purgeUserScopedKeys, purgeServiceWorkerCaches } from '../lib/safeStorage.js'
import { _resetRecurringSyncState } from './useTransactions.js'

const USER_PROFILE_QUERY_KEY = ['user-profile']
const PROFILE_COLUMNS = 'id, display_name, avatar_url, onboarded'

// One place to wipe every device-local trace of the signed-in user.
// Called from both the imperative `signOut()` and the passive `SIGNED_OUT`
// auth event (other tab signed out, server revoked the token, refresh
// failed). Without this, the next user to sign in on the same device sees
// the previous user's data via React Query memory, Workbox cache, or our
// own localStorage keys.
async function purgeAllUserScopedState() {
  try { queryClient.clear() } catch (err) { console.warn('[Kosha] queryClient.clear failed', err) }
  try { _resetRecurringSyncState() } catch (err) { console.warn('[Kosha] _resetRecurringSyncState failed', err) }
  try { purgeUserScopedKeys() } catch (err) { console.warn('[Kosha] purgeUserScopedKeys failed', err) }
  try { await purgeServiceWorkerCaches() } catch (err) { console.warn('[Kosha] purgeServiceWorkerCaches failed', err) }
}

export function useAuthState() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [linkedUserIds, setLinkedUserIds] = useState([])
  const [linkedProfiles, setLinkedProfiles] = useState([])

  const profileQueryKey = useCallback(
    (userId) => [...USER_PROFILE_QUERY_KEY, userId],
    []
  )

  const fetchProfileByUserId = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    return data || null
  }, [])

  // A monotonically increasing counter that lets us discard the result of a
  // previous `loadProfile` if a newer one has already started. Without this,
  // a slow first call (e.g. on flaky network) can resolve AFTER a faster
  // second call and overwrite the fresh profile with a stale one, or — much
  // worse — overwrite the new user's profile with the previous user's data
  // if a sign-out/sign-in happens mid-fetch.
  const loadGenRef = useRef(0)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    const myGen = ++loadGenRef.current
    const isStale = () => loadGenRef.current !== myGen

    setProfileLoading(true)

    try {
      const data = await queryClient.fetchQuery({
        queryKey: profileQueryKey(userId),
        queryFn: () => fetchProfileByUserId(userId),
      })
      if (isStale()) return
      const ids = await fetchLinkedUserIds(userId)
      if (isStale()) return
      const lp = ids.length > 0 ? await fetchLinkedProfiles(userId) : []
      if (isStale()) return

      const fullData = { ...data, linkedUserIds: ids, linkedProfiles: lp, _lastFetched: Date.now() }

      setProfile(fullData)
      setLinkedUserIds(ids)
      setLinkedProfiles(lp)

      // Update cache with the full enriched profile
      queryClient.setQueryData(profileQueryKey(userId), fullData)
    } catch (err) {
      if (isStale()) return
      console.warn('[Kosha] loadProfile failed', err)
      setProfile(null)
      setLinkedUserIds([])
      setLinkedProfiles([])
    } finally {
      if (!isStale()) setProfileLoading(false)
    }
  }, [fetchProfileByUserId, profileQueryKey])

  const invalidateAndRefetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return null
    }

    setProfileLoading(true)

    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: profileQueryKey(userId),
        queryFn: () => fetchProfileByUserId(userId),
        staleTime: 0,
      })

      setProfile(fresh)
      return fresh
    } finally {
      setProfileLoading(false)
    }
  }, [fetchProfileByUserId, profileQueryKey])

  // Keep a ref so the auth effect never needs loadProfile in its dep array.
  // This prevents the auth listener from being torn down & re-registered
  // mid-session when loadProfile's identity changes (which can briefly set
  // profile → null and trigger a profile-loading flash).
  const loadProfileRef = useRef(loadProfile)
  useEffect(() => { loadProfileRef.current = loadProfile }, [loadProfile])

  useEffect(() => {
    let initialised = false
    // Remember the user id we last saw so we can detect identity changes.
    // SIGNED_IN fires both on a brand-new login (clear cache) and on some
    // silent token-refresh paths (keep cache, keep partner-view selection).
    // Comparing against this ref is what makes the difference.
    let lastSeenUserId = null

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null

        if (event === 'INITIAL_SESSION') {
          setAuthUser(u)
          if (u) {
            setErrorReportingUser({ id: u.id })
            initActiveWallet(u.id)
            lastSeenUserId = u.id
          }
          setUser(u)
          setLoading(false)
          initialised = true
          setProfileLoading(!!u)
          if (u) loadProfileRef.current(u.id)
          else {
            setProfile(null)
            setProfileLoading(false)
          }
          return
        }

        if (event === 'TOKEN_REFRESHED') {
          if (!u) return
          setAuthUser(u)
          setUser(u)
          lastSeenUserId = u.id
          setProfile(prev => {
            if (!prev || (Date.now() - (prev._lastFetched || 0) > 30000)) {
              loadProfileRef.current(u.id)
            }
            return prev
          })
          return
        }

        if (event === 'SIGNED_IN') {
          // SIGNED_IN fires in three different situations and each needs a
          // different cache discipline:
          //
          //   (a) Same user as before (silent token-refresh path):
          //       Do NOT clear anything — clearing here would drop the
          //       partner-view selection on every refresh.
          //
          //   (b) Different user than before in the same browser session
          //       (e.g. user A signed out then user B signed in without a
          //       page reload):
          //       Full purge. The SIGNED_OUT branch usually purged already,
          //       but doing it again is cheap and defensive.
          //
          //   (c) Fresh page load with no prior `lastSeenUserId` (e.g. the
          //       previous user closed the tab without signing out — their
          //       Supabase JWT may have already expired so no session is
          //       restored — and a different person opens the browser and
          //       signs in):
          //       We MUST purge the SW `supabase-data` cache here. The
          //       previous user's responses to RLS-filtered URLs like
          //       `GET /rest/v1/split_groups?...` are still present in
          //       Workbox storage and would be served to the new user via
          //       StaleWhileRevalidate. React Query's `clear()` alone does
          //       not help because that's a separate cache layer.
          const userChanged = !!u && lastSeenUserId && lastSeenUserId !== u.id
          const isFirstSignIn = !!u && !lastSeenUserId
          if (userChanged || isFirstSignIn) {
            await purgeAllUserScopedState()
          }
          setAuthUser(u)
          if (u) {
            setErrorReportingUser({ id: u.id })
            initActiveWallet(u.id)
            lastSeenUserId = u.id
          }
          setUser(u)
          if (!initialised) { setLoading(false); initialised = true }
          setProfileLoading(!!u)
          if (u) loadProfileRef.current(u.id)
          else {
            setProfile(null)
            setProfileLoading(false)
          }
          return
        }

        if (event === 'SIGNED_OUT') {
          // This branch is the *passive* sign-out path: another tab signed
          // out, the server revoked the token, or token refresh failed.
          // The imperative `signOut()` callback below also runs this purge
          // explicitly; both call sites must wipe state or the next user to
          // sign in on the same device sees the previous user's data.
          await purgeAllUserScopedState()
          clearAuthUser()
          clearErrorReportingUser()
          lastSeenUserId = null
          setUser(null)
          setProfile(null)
          setLinkedUserIds([])
          setLinkedProfiles([])
          setProfileLoading(false)
          if (!initialised) { setLoading(false); initialised = true }
          return
        }

        if (event === 'USER_UPDATED') {
          setAuthUser(u)
          setUser(u)
          if (u) lastSeenUserId = u.id
          return
        }
      }
    )

    const safetyTimer = setTimeout(() => {
      if (!initialised) {
        console.warn('[Kosha] Auth INITIAL_SESSION did not fire within 3s. Releasing loading state.')
        setLoading(false)
        setProfileLoading(false)
        initialised = true
      }
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // Intentionally empty: auth listener must register exactly once

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
  }, [])

  const signInWithEmail = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    })
    if (error) throw error
    return data
  }, [])

  const signUpWithEmail = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
    return data
  }, [])

  const requestPasswordReset = useCallback(async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/login?reset=1` }
    )
    if (error) throw error
    return data
  }, [])

  const updatePassword = useCallback(async (newPassword) => {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters.')
    }
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    // Order matters here:
    //  1. Tell the server to revoke the session FIRST. If this fails
    //     (network drop) we still purge locally; the server-side session
    //     will be cleaned up the next time the user comes online via the
    //     SIGNED_OUT auth event.
    //  2. Then purge every device-local trace of the user (React Query
    //     memory, our `kosha:*` localStorage keys, and the Workbox
    //     service-worker caches that may hold this user's Supabase REST
    //     responses).
    //  3. Then clear in-memory React state.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.auth.signOut()
      }
    } catch (err) {
      console.warn('[Kosha] server sign-out failed; clearing local state anyway', err)
    } finally {
      await purgeAllUserScopedState()
      clearAuthUser()
      clearErrorReportingUser()
      setUser(null)
      setProfile(null)
      setLinkedUserIds([])
      setLinkedProfiles([])
      setProfileLoading(false)
    }
  }, [])

  const updateProfile = useCallback(async (updates) => {
    const userId = getAuthUserId()
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updates }, { onConflict: 'id' })
      .select(PROFILE_COLUMNS)
      .single()

    if (error) throw error

    setProfile(prev => {
      const merged = { ...(prev || {}), ...data, _lastFetched: Date.now() }
      queryClient.setQueryData(profileQueryKey(userId), merged)
      return merged
    })
    return data
  }, [profileQueryKey])

  const updateDisplayName = useCallback(async (displayName) => {
    const userId = getAuthUserId()
    const trimmedName = String(displayName || '').trim()
    if (!trimmedName) throw new Error('Display name cannot be empty')

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, display_name: trimmedName }, { onConflict: 'id' })
      .select(PROFILE_COLUMNS)
      .single()

    if (error) throw error

    setProfile(prev => {
      const merged = { ...(prev || {}), ...data, _lastFetched: Date.now() }
      queryClient.setQueryData(profileQueryKey(userId), merged)
      return merged
    })
    return data
  }, [profileQueryKey])

  return {
    user, profile, loading, profileLoading,
    linkedUserIds, linkedProfiles,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, updatePassword,
    signOut, updateProfile, updateDisplayName,
    reloadLinkedData: () => user?.id ? loadProfile(user.id) : Promise.resolve(),
  }
}
