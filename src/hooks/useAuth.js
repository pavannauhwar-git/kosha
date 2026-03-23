import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { setAuthUser, clearAuthUser, getAuthUserId } from '../lib/authStore'

const USER_PROFILE_QUERY_KEY = ['user-profile']
const PROFILE_COLUMNS = 'id, display_name, avatar_url, onboarded'

export function useAuthState() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const profileQueryKey = useCallback(
    (userId) => [...USER_PROFILE_QUERY_KEY, userId],
    []
  )

  const fetchProfileByUserId = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single()
    if (error) throw error
    return data || null
  }, [])

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    try {
      const data = await queryClient.fetchQuery({
        queryKey: profileQueryKey(userId),
        queryFn: () => fetchProfileByUserId(userId),
      })
      setProfile(data)
    } catch {
      setProfile(null)
    }
  }, [fetchProfileByUserId, profileQueryKey])

  const invalidateAndRefetchProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return null }

    await queryClient.invalidateQueries({
      queryKey: profileQueryKey(userId),
      refetchType: 'active',
    })

    const fresh = await queryClient.fetchQuery({
      queryKey: profileQueryKey(userId),
      queryFn: () => fetchProfileByUserId(userId),
    })

    setProfile(fresh)
    return fresh
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
          if (u) loadProfile(u.id)
          else   setProfile(null)
          return
        }

        if (event === 'TOKEN_REFRESHED') {
          // FIX (defect 2.1): Update authStore with the new refreshed user.
          // The old mutation code called getSession() which returned null
          // during the refresh window. Now authStore always has the latest
          // valid user object immediately after the token refreshes.
          setAuthUser(u)
          setUser(u)
          return
        }

        if (event === 'SIGNED_IN') {
          setAuthUser(u)
          setUser(u)
          if (!initialised) { setLoading(false); initialised = true }
          if (u) loadProfile(u.id)
          else   setProfile(null)
          return
        }

        if (event === 'SIGNED_OUT') {
          clearAuthUser()
          setUser(null)
          setProfile(null)
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
    const { error } = await supabase
      .from('profiles').update(updates).eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single()
    if (error) throw error
    // Strict server-truth: await full invalidation and refetch
    return await invalidateAndRefetchProfile(userId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidateAndRefetchProfile])

  const updateDisplayName = useCallback(async (displayName) => {
    const userId = getAuthUserId()

    const trimmedName = String(displayName || '').trim()
    if (!trimmedName) throw new Error('Display name cannot be empty')

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmedName })
      .eq('id', userId)

    if (error) throw error

    return invalidateAndRefetchProfile(userId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidateAndRefetchProfile])   // removed `user` from deps

  return {
    user, profile, loading,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, updatePassword,
    signOut, updateProfile, updateDisplayName,
  }
}
