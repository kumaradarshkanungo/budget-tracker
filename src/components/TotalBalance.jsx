import { totalAvailable, totalBankBalance } from '../lib/calc.js'
import { uid } from '../lib/storage.js'
import { Computed, Section, IconButton } from './ui.jsx'
import { MoneyInput, TextInput } from './Inputs.jsx'

// Total Balance — a computed, non-editable "Total Bank Balance" row (sum of the
// month's bank actuals) plus a list of holdings. Every holding has a checkbox:
// CHECKED = excluded from Total Available (money already reflected in a bank's
// actual, e.g. a recurring income that's been received — avoids double counting).
// Total Available = Total Bank Balance + sum of UNCHECKED holdings.
//
// Income-derived holdings (those with an riId, materialized from a recurring
// income) show their amount read-only — the amount is owned by the template and
// re-derived on each sync, so it's edited on the Manage Bills & Incomes page, not
// here. Manual holdings keep an editable label and amount (when the page is in
// edit mode). The checkbox is always interactive — checking off received income
// is an everyday action, not a structural edit.
export function TotalBalance({ month, addRow, updateRow, deleteRow }) {
  const total = totalAvailable(month)
  const bankBalance = totalBankBalance(month)
  return (
    <Section
      title="Total Balance"
      actions={
        <IconButton
          label="Add holding"
          onClick={() => addRow('holdings', { id: uid('h'), label: '', amount: 0, excluded: false })}
        />
      }
    >
      <div className="rows separated">
        <div className="row two holding-computed">
          <span className="cell-display ro text">Total Bank Balance</span>
          <div className="row-end">
            <Computed value={bankBalance} />
          </div>
        </div>
        {(month.holdings || []).map(h => (
          <div className="row two" key={h.id}>
            <span className="holding-label">
              <input
                type="checkbox"
                checked={!!h.excluded}
                onChange={e => updateRow('holdings', h.id, { excluded: e.target.checked })}
                aria-label="Exclude from Total Available (received / already in a bank)"
              />
              {h.riId ? (
                <span className="cell-display ro text">{h.label || '—'}</span>
              ) : (
                <TextInput
                  value={h.label}
                  placeholder="Label"
                  onChange={v => updateRow('holdings', h.id, { label: v })}
                />
              )}
            </span>
            <div className="row-end">
              {h.riId ? (
                <Computed value={h.amount} />
              ) : (
                <MoneyInput value={h.amount} onChange={v => updateRow('holdings', h.id, { amount: v })} />
              )}
              {!h.riId && (
                <IconButton label="Delete" variant="danger" onClick={() => deleteRow('holdings', h.id)} />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="row total-row">
        <span>Total Available</span>
        <Computed value={total} strong />
      </div>
    </Section>
  )
}
