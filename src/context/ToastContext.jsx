import { createContext, useContext, useMemo } from 'react'
import useToast from '../hooks/useToast'
import AppToast from '../components/common/AppToast'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const { toast, toastAction, toastActionLabel, pushToast, dismissToast } = useToast()
  
  const value = useMemo(() => ({ pushToast, dismissToast }), [pushToast, dismissToast])
  
  return (
    <ToastContext.Provider value={value}>
      {children}
      <AppToast
        message={toast}
        onDismiss={dismissToast}
        action={toastAction}
        actionLabel={toastActionLabel}
      />
    </ToastContext.Provider>
  )
}

export function useAppToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useAppToast must be used within <ToastProvider>')
  return ctx
}
