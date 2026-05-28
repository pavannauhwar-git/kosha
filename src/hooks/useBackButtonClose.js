import { useEffect } from 'react'

export function useBackButtonClose(open, onClose) {
  useEffect(() => {
    if (!open) return undefined
    const stateKey = `kosha:back:${Math.random().toString(36).slice(2)}`
    window.history.pushState({ koshaModal: stateKey }, '')
    
    const handlePopState = () => {
      onClose?.()
    }
    
    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (window.history.state?.koshaModal === stateKey) {
        window.history.back()
      }
    }
  }, [open, onClose])
}
