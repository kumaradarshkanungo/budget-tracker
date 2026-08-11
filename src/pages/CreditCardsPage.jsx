import { useStoreCtx } from '../context/StoreContext.jsx'
import { CreditCardSpends } from '../components/CreditCardSpends.jsx'

// The credit-card spends route at "/credit-cards". Read-only by default; it
// inherits the App-level EditModeProvider (around <Outlet>) driven by the month
// bar's Edit toggle, so it locks/unlocks exactly like the dashboard. The + FAB
// and its add-modal stay usable regardless — they don't read the edit context.
export function CreditCardsPage() {
  const { store: s } = useStoreCtx()
  return (
    <CreditCardSpends
      month={s.month}
      settings={s.settings}
      addRow={s.addRow}
      updateRow={s.updateRow}
      deleteRow={s.deleteRow}
    />
  )
}
