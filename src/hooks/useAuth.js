import { useState, useEffect, useCallback, createContext, useContext, createElement } from 'react'
import { supabase } from '../lib/supabase'

// ── Auth Context ──────────────────────────────────────────────────────────
// All components share ONE auth state via this context.
const AuthContext = createContext(null)

// ── Synchronous localStorage pre-check ───────────────────────────────────
// Supabase stores its session under sb-<project-ref>-auth-token.
// If that key is absent, there is definitively no session — skip the
// async getSession() call entirely and jump straight to login instantly.
function hasStoredSession() {
  try {
    const projectRef = import.meta.env.VITE_SUPABASE_URL
      ?.replace('https://', '')
      .split('.')[0]
    if (!projectRef) return false
    return !!localStorage.getItem(`sb-${projectRef}-auth-token`)
  } catch {
    // localStorage blocked (e.g. private browsing quirks) — fall through
    return true
  }
}

// ── Internal hook (single instance, lives inside AuthProvider) ────────────
function useAuthState() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  // If there's no stored session token, we already know the answer.
  // Initialise loading=false so AuthGuard redirects to login instantly —
  // no spinner, no async wait, no delay.
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
    // ── Fast path: no token in localStorage → already signed out ──────
    // loading was initialised to false above, nothing async needed.
    if (!hasStoredSession()) return

    // ── Primary: getSession on mount ───────────────────────────────────
    // Only reached when a Supabase token exists in localStorage.
    // Refreshes it if expired. Wrapped in a 6s timeout so a hanging
    // network call never leaves the app stuck.
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
        // Token refresh failed, timed out, or network error —
        // treat as signed-out so the app is never stuck.
        setUser(null)
        setProfile(null)
      } finally {
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