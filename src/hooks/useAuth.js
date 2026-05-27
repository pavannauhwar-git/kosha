import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { setAuthUser, clearAuthUser, getAuthUserId } from '../lib/authStore'
import { setErrorReportingUser, clearErrorReportingUser } from '../lib/errorReporting'
import { initActiveWallet } from '../lib/walletStore'
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
      
      const fullData = { ...data, linkedUserIds: ids, linkedProfiles: lp, _lastFetched: Date.now() }
      
      setProfile(fullData)
      setLinkedUserIds(ids)
      setLinkedProfiles(lp)
      
      // Update cache with the full enriched profile
      queryClient.setQueryData(profileQueryKey(userId), fullData)
    } catch (err) {
      console.warn('[Kosha] loadProfile failed', err)
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

  // Keep a ref so the auth effect never needs loadProfile in its dep array.
  // This prevents the auth listener from being torn down & re-registered
  // mid-session when loadProfile's identity changes (which can briefly set
  // profile → null and trigger a profile-loading flash).
  const loadProfileRef = useRef(loadProfile)
  useEffect(() => { loadProfileRef.current = loadProfile }, [loadProfile])

  useEffect(() => {
    let initialised = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null

        if (event === 'INITIAL_SESSION') {
          setAuthUser(u)
          if (u) {
            setErrorReportingUser({ id: u.id })
            initActiveWallet(u.id)
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
          setProfile(prev => {
            if (!prev || (Date.now() - (prev._lastFetched || 0) > 30000)) {
              loadProfileRef.current(u.id)
            }
            return prev
          })
          return
        }

        if (event === 'SIGNED_IN') {
          queryClient.clear()
          setAuthUser(u)
          if (u) {
            setErrorReportingUser({ id: u.id })
            initActiveWallet(u.id)
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
          clearAuthUser()
          clearErrorReportingUser()
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
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.auth.signOut()
      }
    } catch {
      // Server sign-out failed — still clear local state
    } finally {
      // Clear the query cache FIRST so any in-flight realtime callbacks
      // that fire in the gap cannot store data under a null user key.
      queryClient.clear()
      clearAuthUser()
      setUser(null)
      setProfile(null)
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
