import { createContext, useContext } from 'react'

const AppDataContext = createContext({})

export function AppDataProvider({ children }) {
  return (
    <AppDataContext.Provider value={{}}>
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData() {
  return {}
}
