import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) await loadProfile(u.id)
      setLoading(false)
      initialised.current = true
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null

        if (event === 'TOKEN_REFRESHED') {
          setUser(u)
          return
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        setUser(u)
        if (u) await loadProfile(u.id)
        else setProfile(null)

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
