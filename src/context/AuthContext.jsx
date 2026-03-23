import { createContext, useContext, createElement, useMemo } from 'react'
import { useAuthState } from '../hooks/useAuth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const {
    user, profile, loading,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, updatePassword,
    signOut, updateProfile, updateDisplayName,
  } = useAuthState()

  // FIX (defect 4.1): Without this memo, AuthProvider creates a new object
  // literal on every render, causing every component that calls useAuth() to
  // re-render — even if none of the actual values changed. The callbacks from
  // useAuthState are already stable via useCallback. The state values only
  // change when auth state genuinely changes. This memo ensures the context
  // value reference only changes when something meaningful actually changed.
  const value = useMemo(() => ({
    user, profile, loading,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, updatePassword,
    signOut, updateProfile, updateDisplayName,
  }), [
    user, profile, loading,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, updatePassword,
    signOut, updateProfile, updateDisplayName,
  ])

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
