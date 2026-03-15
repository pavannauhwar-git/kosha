import { useState, useEffect, useCallback, createContext, useContext, createElement } from 'react'
import { supabase } from '../lib/supabase'

// ── Auth Context ──────────────────────────────────────────────────────────
const AuthContext = createContext(null)

// ── Synchronous localStorage pre-check ───────────────────────────────────
// Supabase stores its session under sb-<project-ref>-auth-token.
// If absent, there is no session — skip the async getSession() call
// and go straight to login instantly.
function hasStoredSession() {
  try {
    const projectRef = import.meta.env.VITE_SUPABASE_URL
      ?.replace('https://', '')
      .split('.')[0]
    if (!projectRef) return false
    return !!localStorage.getItem(`sb-${projectRef}-auth-token`)
  } catch {
    return true // localStorage blocked — fall through to getSession safely
  }
}

// ── Internal hook (single instance, lives inside AuthProvider) ────────────
function useAuthState() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  // No stored token = we already know loading is done, skip the spinner
  const [loading, setLoading] = useState(() => hasStoredSession())

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
    // ── onAuthStateChange is ALWAYS set up ────────────────────────────
    // Critical: this must never be skipped. It handles sign-in after
    // the user submits the login form, token refresh, and sign-out.
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
          // Ensure loading is cleared in case getSession was skipped
          setLoading(false)
        }
      }
    )

    // ── Fast path: no token → already signed out, skip network call ───
    // loading was initialised false above — just clean up and return.
    if (!hasStoredSession()) {
      return () => subscription.unsubscribe()
    }

    // ── Primary: getSession — only when a token exists ─────────────────
    // Reads + refreshes the token if expired. 6s timeout as safety net.
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
