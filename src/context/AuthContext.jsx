import { createContext, useContext, createElement, useMemo } from 'react'
import { useAuthState } from '../hooks/useAuth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const {
    user, profile, loading, profileLoading,
    linkedUserIds, linkedProfiles,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, updatePassword,
    signOut, updateProfile, updateDisplayName,
    reloadLinkedData,
  } = useAuthState()

  const value = useMemo(() => ({
    user, profile, loading, profileLoading,
    linkedUserIds, linkedProfiles,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, updatePassword,
    signOut, updateProfile, updateDisplayName,
    reloadLinkedData,
  }), [
    user, profile, loading, profileLoading,
    linkedUserIds, linkedProfiles,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, updatePassword,
    signOut, updateProfile, updateDisplayName,
    reloadLinkedData,
  ])

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
