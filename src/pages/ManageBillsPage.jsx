import { useStoreCtx } from '../context/StoreContext.jsx'
import { ManageBills } from '../components/ManageBills.jsx'

// The "Manage Bills & EMIs" route at "/manage-bills". Edit mode is app-wide now:
// it inherits the App-level EditModeProvider (driven by the floating action
// button) and resets on navigation via App's route-change effect. The nav drawer
// and floating action button handle leaving the page, so there's no in-page Back.
export function ManageBillsPage() {
  const { store: s } = useStoreCtx()
  return (
    <ManageBills
      month={s.month}
      settings={s.settings}
      addRecurringBill={s.addRecurringBill}
      updateRecurringBill={s.updateRecurringBill}
      deleteRecurringBill={s.deleteRecurringBill}
      syncRecurringNow={s.syncRecurringNow}
      addRecurringIncome={s.addRecurringIncome}
      updateRecurringIncome={s.updateRecurringIncome}
      deleteRecurringIncome={s.deleteRecurringIncome}
      addRecurringEmi={s.addRecurringEmi}
      updateRecurringEmi={s.updateRecurringEmi}
      deleteRecurringEmi={s.deleteRecurringEmi}
    />
  )
}
