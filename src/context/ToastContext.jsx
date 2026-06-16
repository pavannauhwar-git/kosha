import { createContext, useContext } from 'react'
import useToast from '../hooks/useToast'
import AppToast from '../components/common/AppToast'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const { toast, toastAction, toastActionLabel, pushToast, dismissToast } = useToast()
  return (
    <ToastContext.Provider value={{ pushToast, dismissToast }}>
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
