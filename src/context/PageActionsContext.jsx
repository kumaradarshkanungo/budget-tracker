import { createContext, useContext, useState, useEffect, useMemo } from 'react'

// Lets the current page register its ONE primary "add" action (e.g. the
// credit-card spends screen's add-spend modal) so the app-level floating action
// button can trigger it without owning the modal's state. Pages with no primary
// add simply register nothing and the FAB shows only Edit/Save.
const PageActionsContext = createContext({
  action: null,
  registerAction: () => {},
  clearAction: () => {},
})

export function PageActionsProvider({ children }) {
  // `action` is { onAdd, addLabel } or null.
  const [action, setAction] = useState(null)
  const value = useMemo(
    () => ({
      action,
      registerAction: a => setAction(a),
      clearAction: () => setAction(null),
    }),
    [action]
  )
  return <PageActionsContext.Provider value={value}>{children}</PageActionsContext.Provider>
}

// Read the registered primary action (used by the FAB).
export function usePageActions() {
  return useContext(PageActionsContext)
}

// Register a page's primary add action for the lifetime of the component (and
// re-register when `deps` change so the callback stays fresh). Clears on unmount
// so navigating to a page without an add action hides the FAB's + pill.
export function useRegisterPageAction(onAdd, addLabel, deps = []) {
  const { registerAction, clearAction } = usePageActions()
  useEffect(() => {
    registerAction({ onAdd, addLabel })
    return () => clearAction()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
