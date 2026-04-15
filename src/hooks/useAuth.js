import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { setAuthUser, clearAuthUser, getAuthUserId } from '../lib/authStore'
import { fetchLinkedUserIds, fetchLinkedProfiles } from '../lib/walletSync'

const USER_PROFILE_QUERY_KEY = ['user-profile']
const PROFILE_COLUMNS = 'id, display_name, avatar_url, onboarded'

export function useAuthState() {
  const [user,    setUser]    = useState(null)
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

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)

    try {
      const data = await queryClient.fetchQuery({
        queryKey: profileQueryKey(userId),
        queryFn: () => fetchProfileByUserId(userId),
      })
      const ids = await fetchLinkedUserIds(userId)
      const lp = ids.length > 0 ? await fetchLinkedProfiles(userId) : []
      
      const fullData = { ...data, linkedUserIds: ids, linkedProfiles: lp }
      
      setProfile(fullData)
      setLinkedUserIds(ids)
      setLinkedProfiles(lp)
      
      // Update cache with the full enriched profile
      queryClient.setQueryData(profileQueryKey(userId), fullData)
    } catch {
      setProfile(null)
      setLinkedUserIds([])
      setLinkedProfiles([])
    } finally {
      setProfileLoading(false)
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

  useEffect(() => {
    let initialised = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null

        if (event === 'INITIAL_SESSION') {
          // FIX (defect 2.1, 2.3): Write to authStore FIRST so any mutation
          // that fires immediately after the app becomes interactive will find
          // a valid user ID — even if the token is about to be refreshed.
          // This eliminates the cold-start "Not signed in" race condition.
          setAuthUser(u)

          setUser(u)
          setLoading(false)
          initialised = true
          setProfileLoading(!!u)
          if (u) loadProfile(u.id)
          else {
            setProfile(null)
            setProfileLoading(false)
          }
          return
        }

        if (event === 'TOKEN_REFRESHED') {
          // FIX (defect 2.1): Update authStore with the new refreshed user.
          // The old mutation code called getSession() which returned null
          // during the refresh window. Now authStore always has the latest
          // valid user object immediately after the token refreshes.
          // Guard: if the refresh failed silently, u can be null — keep existing user.
          if (!u) return
          setAuthUser(u)
          setUser(u)
          return
        }

        if (event === 'SIGNED_IN') {
          setAuthUser(u)
          setUser(u)
          if (!initialised) { setLoading(false); initialised = true }
          setProfileLoading(!!u)
          if (u) loadProfile(u.id)
          else {
            setProfile(null)
            setProfileLoading(false)
          }
          return
        }

        if (event === 'SIGNED_OUT') {
          clearAuthUser()
          setUser(null)
          setProfile(null)
          setProfileLoading(false)
          if (!initialised) { setLoading(false); initialised = true }
          return
        }

        if (event === 'USER_UPDATED') {
          setAuthUser(u)
          setUser(u)
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
  }, [loadProfile])

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
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Server sign-out failed — still clear local state
    } finally {
      clearAuthUser()
      setUser(null)
      setProfile(null)
      setProfileLoading(false)
      queryClient.clear()
    }
  }, [])

  // FIX (defect 4.5): updateProfile and updateDisplayName previously closed over
  // the `user` state variable, meaning they were recreated as new function
  // references on every auth event (since `user` gets a new object reference
  // each time AuthContext re-renders). Any component with these in a useCallback
  // dep array would also recreate its own callbacks, propagating instability.
  //
  // Fix: read the userId synchronously from authStore (stable module singleton)
  // instead of from the `user` closure. The dep array becomes [] — these
  // functions are now created once and never recreated.
  const updateProfile = useCallback(async (updates) => {
    const userId = getAuthUserId()
    const payload = {
      id: userId,
      ...updates,
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select(PROFILE_COLUMNS)
      .single()
    if (error) throw error
    setProfile(data)
    queryClient.setQueryData(profileQueryKey(userId), data)
    return data
  }, [profileQueryKey])

  const updateDisplayName = useCallback(async (displayName) => {
    const userId = getAuthUserId()

    const trimmedName = String(displayName || '').trim()
    if (!trimmedName) throw new Error('Display name cannot be empty')

    const { data,error } = await supabase
      .from('profiles')
      .upsert({ id: userId, display_name: trimmedName }, { onConflict: 'id' })
      .select(PROFILE_COLUMNS)
      .single()

    if (error) throw error

    setProfile(data)
    queryClient.setQueryData(profileQueryKey(userId), data)
    return data
  }, [profileQueryKey])

  return {
    user, profile, loading, profileLoading,
    linkedUserIds, linkedProfiles,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, updatePassword,
    signOut, updateProfile, updateDisplayName,
  }
}
