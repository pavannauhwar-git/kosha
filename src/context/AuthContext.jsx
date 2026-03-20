import { createContext, useContext, createElement } from 'react'
import { useAuthState } from '../hooks/useAuth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const auth = useAuthState()
  return createElement(AuthContext.Provider, { value: auth }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
