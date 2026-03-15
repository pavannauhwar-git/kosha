import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── The key insight ───────────────────────────────────────────────────────
// getSession() reads the token from localStorage but does NOT guarantee
// the Supabase client has fully initialised the session — meaning RLS
// queries made immediately after will fail or hang in a fresh tab.
//
// onAuthStateChange fires AFTER Supabase has fully confirmed the session
// with the server and the JWT is ready to use. This is the only safe
// place to load the profile.
//
// Flow:
// 1. App boots → loading=true
// 2. Supabase detects token in localStorage → fires INITIAL_SESSION event
// 3. onAuthStateChange handles it → loads profile → sets loading=false
// 4. AuthGuard renders with both user and profile guaranteed to be set

export function useAuth() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data || null)
  }, [])

  useEffect(() => {
    // Subscribe to auth state changes — this is the ONLY place we load
    // profile and set loading=false. onAuthStateChange fires:
    // - INITIAL_SESSION on app boot (replaces needing getSession())
    // - SIGNED_IN after login
    // - SIGNED_OUT after logout
    // - TOKEN_REFRESHED on token rotation (we ignore this)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        if (event === 'TOKEN_REFRESHED') {
          // Token rotated — session still valid, profile unchanged
          // Just update user silently, don't reload profile or touch loading
          setUser(session?.user ?? null)
          return
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        // INITIAL_SESSION, SIGNED_IN, USER_UPDATED
        // Session is fully confirmed and JWT is ready — safe to query
        const u = session?.user ?? null
        setUser(u)

        if (u) {
          await loadProfile(u.id)
        } else {
          setProfile(null)
        }

        // Both user and profile are now set — safe to render
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
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
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
    return data
  }, [])

  const signUpWithEmail = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // SIGNED_OUT event above handles clearing state
  }, [])

  const updateProfile = useCallback(async (updates) => {
    if (!user) throw new Error('Not signed in')
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }, [user])

  return {
    user,
    profile,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateProfile,
  }
}
