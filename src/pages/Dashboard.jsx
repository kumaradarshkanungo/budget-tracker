import { useStoreCtx } from '../context/StoreContext.jsx'
import { SummaryCards } from '../components/SummaryCards.jsx'
import { TotalBalance } from '../components/TotalBalance.jsx'
import { BankBalance } from '../components/BankBalance.jsx'
import { Budget } from '../components/Budget.jsx'
import { BillsEmis } from '../components/BillsEmis.jsx'

// The main budget dashboard at "/".
export function Dashboard() {
  const { store: s } = useStoreCtx()
  const { month } = s

  return (
    <>
      <SummaryCards month={month} />

      <div className="grid">
        <TotalBalance month={month} addRow={s.addRow} updateRow={s.updateRow} deleteRow={s.deleteRow} reorderRow={s.reorderRow} />
        <BankBalance month={month} updateRow={s.updateRow} />
        <Budget month={month} addRow={s.addRow} updateRow={s.updateRow} deleteRow={s.deleteRow} />
      </div>

      <div className="grid-full">
        <BillsEmis month={month} settings={s.settings} addRow={s.addRow} updateRow={s.updateRow} deleteRow={s.deleteRow} addCardBill={s.addCardBill} resetBillToAuto={s.resetBillToAuto} />
      </div>
    </>
  )
}
