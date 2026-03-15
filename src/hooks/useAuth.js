import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Track whether the initial session check has completed.
  // After that, TOKEN_REFRESHED and other background events should
  // NOT flip loading back to true — that's what caused the blank screen.
  const initialised = useRef(false)

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
    // ── Step 1: check existing session on mount ─────────────────────────
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      await loadProfile(u?.id)
      setLoading(false)
      initialised.current = true
    })

    // ── Step 2: listen for future auth changes ──────────────────────────
    // KEY FIX: only update user/profile state, never touch `loading` after
    // initial mount. TOKEN_REFRESHED fires every ~15 mins and was causing
    // loadProfile to run again, briefly setting profile to null, which
    // made AuthGuard blank out the screen.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null

        // TOKEN_REFRESHED — session still valid, just a new token.
        // Update user silently, don't reload profile (it hasn't changed).
        if (event === 'TOKEN_REFRESHED') {
          setUser(u)
          return
        }

        // SIGNED_OUT — clear everything
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          if (initialised.current) setLoading(false)
          return
        }

        // SIGNED_IN, INITIAL_SESSION, USER_UPDATED — load fresh profile
        setUser(u)
        if (u) await loadProfile(u.id)
        else setProfile(null)

        // Only set loading false here if initial getSession hasn't done it yet
        if (!initialised.current) {
          setLoading(false)
          initialised.current = true
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
    setUser(null)
    setProfile(null)
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
