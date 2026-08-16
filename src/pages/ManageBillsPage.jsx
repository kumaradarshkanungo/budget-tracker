import { useNavigate } from 'react-router-dom'
import { useStoreCtx } from '../context/StoreContext.jsx'
import { ManageBills } from '../components/ManageBills.jsx'

// The "Manage Bills & EMIs" route at "/manage-bills". Edit mode is app-wide now:
// it inherits the App-level EditModeProvider (driven by the floating action
// button) and resets on navigation via App's route-change effect.
export function ManageBillsPage() {
  const { store: s } = useStoreCtx()
  const navigate = useNavigate()
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
      onClose={() => navigate('/')}
    />
  )
}
