import { useNavigate } from 'react-router-dom'
import { useStoreCtx } from '../context/StoreContext.jsx'
import { Settings } from '../components/Settings.jsx'

// The settings route at "/settings". Edit mode is app-wide now: it inherits the
// App-level EditModeProvider (driven by the floating action button) and resets
// on navigation via App's route-change effect.
export function SettingsPage() {
  const { store: s } = useStoreCtx()
  const navigate = useNavigate()
  return (
    <Settings
      month={s.month}
      months={s.months}
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
      exportSelectionJSON={s.exportSelectionJSON}
      importJSON={s.importJSON}
      onClose={() => navigate('/')}
    />
  )
}
