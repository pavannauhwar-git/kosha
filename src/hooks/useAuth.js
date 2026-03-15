import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── useAuth ───────────────────────────────────────────────────────────────
// Single source of truth for auth state across the app.
// Returns: { user, profile, loading, signInWithGoogle, signInWithEmail,
//            signUpWithEmail, signOut, updateProfile }
//
// user    — the Supabase auth user object (null if not signed in)
// profile — the row from the profiles table (null until loaded)
// loading — true during the initial session check on app boot

export function useAuth() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Load profile from DB ────────────────────────────────────────────────
  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data || null)
  }, [])

  // ── Listen for auth state changes ───────────────────────────────────────
  // onAuthStateChange fires on: initial load, sign in, sign out,
  // token refresh. This is the only place we set user state.
  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      loadProfile(u?.id).finally(() => setLoading(false))
    })

    // Subscribe to future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        await loadProfile(u?.id)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [loadProfile])

  // ── Google OAuth ────────────────────────────────────────────────────────
  // Redirects to Google, then back to /auth/callback which Supabase handles.
  // After redirect, onAuthStateChange fires and sets user automatically.
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }, [])

  // ── Email sign-in ───────────────────────────────────────────────────────
  const signInWithEmail = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
    return data
  }, [])

  // ── Email sign-up ───────────────────────────────────────────────────────
  // emailRedirectTo is used when email confirmation is enabled in Supabase.
  // If you have email confirmation OFF (recommended for now), this just
  // signs the user in immediately after creating the account.
  const signUpWithEmail = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    return data
  }, [])

  // ── Sign out ────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  // ── Update profile ──────────────────────────────────────────────────────
  // Used by the Onboarding flow to save display_name, monthly_income,
  // and mark onboarded = true.
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
