import { createContext, useContext, useState, useEffect, useMemo } from 'react'

// Lets the current page register actions for the app-level floating action
// button without owning any modal state:
//   - ONE primary "add" action (e.g. the credit-card spends screen's add-spend
//     modal) → the FAB's ＋ pill.
//   - ONE optional "secondary" action (e.g. Credit Card Spends → View insights)
//     → an extra icon pill in the FAB.
// Pages that register nothing simply get a FAB with only Edit/Save.
const PageActionsContext = createContext({
  action: null,
  secondary: null,
  registerAction: () => {},
  clearAction: () => {},
  registerSecondary: () => {},
  clearSecondary: () => {},
})

export function PageActionsProvider({ children }) {
  // `action` is { onAdd, addLabel } or null.
  const [action, setAction] = useState(null)
  // `secondary` is { onRun, label, glyph } or null.
  const [secondary, setSecondary] = useState(null)
  const value = useMemo(
    () => ({
      action,
      secondary,
      registerAction: a => setAction(a),
      clearAction: () => setAction(null),
      registerSecondary: s => setSecondary(s),
      clearSecondary: () => setSecondary(null),
    }),
    [action, secondary]
  )
  return <PageActionsContext.Provider value={value}>{children}</PageActionsContext.Provider>
}

// Read the registered actions (used by the FAB).
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

// Register a page's optional secondary action (an extra icon pill in the FAB).
// `glyph` is the icon shown; `label` is used for aria-label/title. Clears on
// unmount so it never leaks to other pages.
export function useRegisterSecondaryAction(onRun, label, glyph, deps = []) {
  const { registerSecondary, clearSecondary } = usePageActions()
  useEffect(() => {
    registerSecondary({ onRun, label, glyph })
    return () => clearSecondary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
