import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data || null)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    // ── Primary: getSession on mount ──────────────────────────────────
    // Reads token from localStorage immediately and resolves in <200ms.
    // This is the reliable way to restore session in a fresh tab.
    // onAuthStateChange INITIAL_SESSION is unreliable on Vercel PWAs.
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const u = session?.user ?? null
        setUser(u)
        if (u) await loadProfile(u.id)
        else setProfile(null)
      } catch {
        setUser(null)
        setProfile(null)
      } finally {
        // Always set loading=false — never leave the app stuck
        setLoading(false)
      }
    }

    init()

    // ── Secondary: onAuthStateChange for live events ───────────────────
    // Handles sign-in, sign-out, and token refresh AFTER initial load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null)
          return
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          return
        }

        if (event === 'SIGNED_IN') {
          const u = session?.user ?? null
          setUser(u)
          if (u) await loadProfile(u.id)
          else setProfile(null)
        }
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
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  const updateProfile = useCallback(async (updates) => {
    if (!user) throw new Error('Not signed in')
    const { data, error } = await supabase
      .from('profiles').update(updates).eq('id', user.id).select().single()
    if (error) throw error
    setProfile(data)
    return data
  }, [user])

  return {
    user, profile, loading,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    signOut, updateProfile,
  }
}
