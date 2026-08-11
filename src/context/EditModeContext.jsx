import { createContext, useContext } from 'react'

// Whether the dashboard's inputs are editable. Default false = read-only, so
// the page opens locked and an explicit Edit toggle unlocks it. Shared inputs
// (MoneyInput/TextInput/IconButton) and the bills controls read this.
const EditModeContext = createContext(false)

export function EditModeProvider({ editable, children }) {
  return <EditModeContext.Provider value={editable}>{children}</EditModeContext.Provider>
}

export function useEditable() {
  return useContext(EditModeContext)
}
