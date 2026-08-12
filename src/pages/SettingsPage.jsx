import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStoreCtx } from '../context/StoreContext.jsx'
import { EditModeProvider } from '../context/EditModeContext.jsx'
import { Settings } from '../components/Settings.jsx'

// The settings route at "/settings". Read-only by default; a page-level Edit
// toggle (rendered in the settings header) unlocks the manage-lists and the
// Default Bank picker, mirroring the dashboard's month-bar Edit toggle.
export function SettingsPage() {
  const { store: s } = useStoreCtx()
  const navigate = useNavigate()
  const [editable, setEditable] = useState(false)
  return (
    <EditModeProvider editable={editable}>
      <Settings
        month={s.month}
        settings={s.settings}
        addBank={s.addBank}
        renameBank={s.renameBank}
        deleteBank={s.deleteBank}
        setDefaultBank={s.setDefaultBank}
        addCard={s.addCard}
        deleteCard={s.deleteCard}
        addSpendCategory={s.addSpendCategory}
        renameSpendCategory={s.renameSpendCategory}
        deleteSpendCategory={s.deleteSpendCategory}
        addRecurringBill={s.addRecurringBill}
        updateRecurringBill={s.updateRecurringBill}
        deleteRecurringBill={s.deleteRecurringBill}
        editable={editable}
        onToggleEdit={() => setEditable(v => !v)}
        onClose={() => navigate('/')}
      />
    </EditModeProvider>
  )
}
