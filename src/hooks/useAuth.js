import { useState, useEffect, useCallback, createContext, useContext, createElement } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'

const USER_PROFILE_QUERY_KEY = ['user-profile']
const PROFILE_COLUMNS = 'id, display_name, avatar_url, onboarded'

// ── Auth Context ──────────────────────────────────────────────────────────
const AuthContext = createContext(null)

// ── Internal hook (single instance, lives inside AuthProvider) ────────────
function useAuthState() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const profileQueryKey = useCallback((userId) => ([...USER_PROFILE_QUERY_KEY, userId]), [])

  const fetchProfileByUserId = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single()
    if (error) throw error
    return data || null
  }, [])

  // Fire-and-forget: loads profile without blocking auth loading state.
  // The rest of the app renders immediately once user is known —
  // profile data arrives a moment later and slots in silently.
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
    if (!userId) {
      setProfile(null)
      return null
    }

    await queryClient.invalidateQueries({
      queryKey: profileQueryKey(userId),
      refetchType: 'all',
    })

    const fresh = await queryClient.fetchQuery({
      queryKey: profileQueryKey(userId),
      queryFn: () => fetchProfileByUserId(userId),
    })

    setProfile(fresh)
    return fresh
  }, [fetchProfileByUserId, profileQueryKey])

  useEffect(() => {
    // ── Single source of truth: onAuthStateChange ─────────────────────
    //
    // Supabase v2 fires events in this order on page load:
    //   INITIAL_SESSION → fires immediately from localStorage (no network)
    //   TOKEN_REFRESHED → fires shortly after if token was near expiry
    //
    // By handling ALL events here we avoid the two problems that plagued
    // the previous implementation:
    //
    //   Problem 1 — The 6-second timeout on getSession() would fire on
    //   slow mobile connections, catch() would run, setUser(null) would
    //   be called, and AuthGuard would redirect to /login mid-session.
    //   The timeout is now GONE entirely.
    //
    //   Problem 2 — INITIAL_SESSION was not handled, so the app always
    //   fell through to getSession() — the slow network path — even when
    //   a valid session was sitting in localStorage.
    //
    // The auth loading state is set to false after the first event fires.
    // INITIAL_SESSION fires synchronously from localStorage in < 5ms,
    // so the skeleton in AuthGuard is visible for an imperceptibly short
    // time before the real content loads.

    let initialised = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        const u = session?.user ?? null

        // ── INITIAL_SESSION: fired synchronously from localStorage ─────
        // This is the first event on every page load. session is whatever
        // is in localStorage — no network call needed.
        if (event === 'INITIAL_SESSION') {
          setUser(u)
          setLoading(false)           // ← unblocks AuthGuard immediately
          initialised = true
          if (u) loadProfile(u.id)   // ← non-blocking, runs in background
          else   setProfile(null)
          return
        }

        // ── TOKEN_REFRESHED: silent token refresh completed ───────────
        // Token was near expiry on load; Supabase refreshed it. Update
        // the user object so the new token is used for all future requests.
        if (event === 'TOKEN_REFRESHED') {
          setUser(u)
          return
        }

        // ── SIGNED_IN: explicit login action ─────────────────────────
        if (event === 'SIGNED_IN') {
          setUser(u)
          if (!initialised) { setLoading(false); initialised = true }
          if (u) loadProfile(u.id)
          else   setProfile(null)
          return
        }

        // ── SIGNED_OUT: explicit logout or session expiry ─────────────
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          if (!initialised) { setLoading(false); initialised = true }
          return
        }

        // ── USER_UPDATED: email/password change ───────────────────────
        if (event === 'USER_UPDATED') {
          setUser(u)
          return
        }
      }
    )

    // ── Safety net ───────────────────────────────────────────────────
    // In the unlikely event onAuthStateChange never fires INITIAL_SESSION
    // (e.g. Supabase client is misconfigured, or running in an environment
    // where localStorage is unavailable), release the loading state after
    // 3 seconds so the app doesn't hang indefinitely.
    // This does NOT log the user out — it just sets loading = false and
    // lets AuthGuard decide what to show based on whatever state exists.
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

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Server sign-out failed (network error, timeout, etc.)
      // Still clear local state — the user must always be able to log out.
    } finally {
      setUser(null)
      setProfile(null)
      queryClient.removeQueries({ queryKey: USER_PROFILE_QUERY_KEY })
    }
  }, [])

  const updateProfile = useCallback(async (updates) => {
    if (!user) throw new Error('Not signed in')
    const { data, error } = await supabase
      .from('profiles').update(updates).eq('id', user.id)
      .select(PROFILE_COLUMNS)
      .single()
    if (error) throw error
    queryClient.setQueryData(profileQueryKey(user.id), data)
    setProfile(data)
    return data
  }, [profileQueryKey, user])

  const updateDisplayName = useCallback(async (displayName) => {
    if (!user) throw new Error('Not signed in')

    const trimmedName = String(displayName || '').trim()
    if (!trimmedName) {
      throw new Error('Display name cannot be empty')
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmedName })
      .eq('id', user.id)

    if (error) throw error

    return invalidateAndRefetchProfile(user.id)
  }, [invalidateAndRefetchProfile, user])

  return {
    user, profile, loading,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    signOut, updateProfile, updateDisplayName,
  }
}

// ── AuthProvider — wrap your app once in App.jsx ──────────────────────────
export function AuthProvider({ children }) {
  const auth = useAuthState()
  return createElement(AuthContext.Provider, { value: auth }, children)
}

// ── useAuth — same export name, same import path, zero changes elsewhere ──
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
