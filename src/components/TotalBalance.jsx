import { totalAvailable } from '../lib/calc.js'
import { uid } from '../lib/storage.js'
import { Computed, Section, IconButton } from './ui.jsx'
import { MoneyInput, TextInput } from './Inputs.jsx'

// Total Balance — list of holdings that sum into Total Available.
export function TotalBalance({ month, addRow, updateRow, deleteRow }) {
  const total = totalAvailable(month)
  return (
    <Section
      title="Total Balance"
      actions={
        <IconButton
          label="Add holding"
          onClick={() => addRow('holdings', { id: uid('h'), label: '', amount: 0 })}
        />
      }
    >
      <div className="rows separated">
        {(month.holdings || []).map(h => (
          <div className="row two" key={h.id}>
            <TextInput
              value={h.label}
              placeholder="Label"
              onChange={v => updateRow('holdings', h.id, { label: v })}
            />
            <div className="row-end">
              <MoneyInput value={h.amount} onChange={v => updateRow('holdings', h.id, { amount: v })} />
              <IconButton label="Delete" variant="danger" onClick={() => deleteRow('holdings', h.id)} />
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
