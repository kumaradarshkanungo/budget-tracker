import { useStoreCtx } from '../context/StoreContext.jsx'
import { CreditCardInsights } from '../components/CreditCardInsights.jsx'

// Route at "/credit-cards/insights" — a detailed, read-only view of the active
// month's credit-card spends (donut + breakdown bars). The month bar (shown via
// App's showMonthBar) drives which month is analysed.
export function CreditCardInsightsPage() {
  const { store: s } = useStoreCtx()
  return <CreditCardInsights month={s.month} settings={s.settings} />
}
