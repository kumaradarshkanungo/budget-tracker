import { budgetRow, budgetTotals } from '../lib/calc.js'
import { uid } from '../lib/storage.js'
import { Computed, Section, IconButton } from './ui.jsx'
import { MoneyInput, TextInput } from './Inputs.jsx'

// Budget — per category: Spend (input), Budget (input), Left = Budget - Spend.
export function Budget({ month, addRow, updateRow, deleteRow }) {
  const totals = budgetTotals(month)
  return (
    <Section
      title="Budget"
      actions={
        <IconButton
          label="Add category"
          onClick={() =>
            addRow('budget', { id: uid('bg'), category: '', spend: 0, budget: 0 })
          }
        />
      }
    >
      <div className="table budget-table">
        <div className="thead">
          <span>Category</span>
          <span>Spend</span>
          <span>Budget</span>
          <span>Left</span>
          <span />
        </div>
        {(month.budget || []).map(r => {
          const { left } = budgetRow(r)
          return (
            <div className="trow" key={r.id}>
              <span data-label="Category">
                <TextInput
                  value={r.category}
                  placeholder="Category"
                  onChange={v => updateRow('budget', r.id, { category: v })}
                />
              </span>
              <span data-label="Spend">
                <MoneyInput value={r.spend} onChange={v => updateRow('budget', r.id, { spend: v })} />
              </span>
              <span data-label="Budget">
                <MoneyInput value={r.budget} onChange={v => updateRow('budget', r.id, { budget: v })} />
              </span>
              <span data-label="Left">
                <Computed value={left} />
              </span>
              <span className="row-actions">
                <IconButton label="Delete" variant="danger" onClick={() => deleteRow('budget', r.id)} />
              </span>
            </div>
          )
        })}
        <div className="trow total">
          <span data-label="Category">Total</span>
          <span data-label="Spend"><Computed value={totals.spend} strong /></span>
          <span data-label="Budget"><Computed value={totals.budget} strong /></span>
          <span data-label="Left"><Computed value={totals.left} strong /></span>
          <span />
        </div>
      </div>
    </Section>
  )
}
