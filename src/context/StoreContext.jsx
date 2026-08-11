import { createContext, useContext } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useBudgetStore } from '../hooks/useBudgetStore.js'

// Provides one shared store + auth instance to every route, so navigating
// between pages doesn't create separate state or re-pull data.
const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const auth = useAuth()
  const store = useBudgetStore(auth.user?.id)
  return <StoreContext.Provider value={{ auth, store }}>{children}</StoreContext.Provider>
}

export function useStoreCtx() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStoreCtx must be used within StoreProvider')
  return ctx
}
