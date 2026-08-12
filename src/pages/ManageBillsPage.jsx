import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStoreCtx } from '../context/StoreContext.jsx'
import { EditModeProvider } from '../context/EditModeContext.jsx'
import { ManageBills } from '../components/ManageBills.jsx'

// The "Manage Bills & EMIs" route at "/manage-bills". Read-only by default; a
// page-level Edit toggle (rendered in the header) unlocks the fields. Edit state
// is local to this page — its own EditModeProvider and useState mean navigating
// away (which unmounts the page) reverts edit mode automatically.
export function ManageBillsPage() {
  const { store: s } = useStoreCtx()
  const navigate = useNavigate()
  const [editable, setEditable] = useState(false)
  return (
    <EditModeProvider editable={editable}>
      <ManageBills
        month={s.month}
        settings={s.settings}
        addRecurringBill={s.addRecurringBill}
        updateRecurringBill={s.updateRecurringBill}
        deleteRecurringBill={s.deleteRecurringBill}
        syncRecurringNow={s.syncRecurringNow}
        editable={editable}
        onToggleEdit={() => setEditable(v => !v)}
        onClose={() => navigate('/')}
      />
    </EditModeProvider>
  )
}
