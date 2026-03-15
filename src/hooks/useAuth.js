import { useState, useEffect, useCallback, createContext, useContext, createElement } from 'react'
import { supabase } from '../lib/supabase'

// ── Auth Context ──────────────────────────────────────────────────────────
const AuthContext = createContext(null)

// ── Internal hook (single instance, lives inside AuthProvider) ────────────
function useAuthState() {
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
    // ── Secondary: onAuthStateChange for live events ───────────────────
    // Registered FIRST so no events are missed during init.
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

    // ── Primary: getSession on mount ──────────────────────────────────
    // Reads token from localStorage and refreshes it if expired.
    // Wrapped in a 6s timeout so a hanging refresh never leaves the
    // app stuck on a blank page.
    async function init() {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth init timeout')), 6000)
      )
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          timeout,
        ])
        const u = session?.user ?? null
        setUser(u)
        if (u) await loadProfile(u.id)
        else setProfile(null)
      } catch {
        setUser(null)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    init()

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
    try {
      await supabase.auth.signOut()
    } catch {
      // Server sign-out failed (network error, timeout, etc.)
      // Still clear local state — the user must always be able to log out.
    } finally {
      setUser(null)
      setProfile(null)
    }
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
