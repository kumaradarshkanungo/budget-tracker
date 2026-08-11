import { bankRequired, bankExtra } from '../lib/calc.js'
import { Computed, Section } from './ui.jsx'
import { MoneyInput } from './Inputs.jsx'

// Bank Balance — Required is auto (unpaid bills for the bank + remaining budget
// if it's the default/primary bank). Actual is the only editable field here.
// Extra = Actual - Required. Bank name, adding banks, and deleting banks are
// managed in Settings (single source of truth), so the dashboard shows the name
// read-only and offers no add/delete.
export function BankBalance({ month, updateRow }) {
  return (
    <Section title="Bank Balance" accent="#3aa0d8">
      <div className="bank-list">
        {(month.banks || []).map(b => {
          const required = bankRequired(month, b)
          const extra = bankExtra(month, b)
          return (
            <div className="bank-card" key={b.id}>
              <div className="bank-card-head">
                <span className="bank-name ro">{b.name || 'Bank'}</span>
                {b.primary && (
                  <span className="primary-tag" title="Default bank (set in Settings) — gets the remaining budget added to Required">
                    Default
                  </span>
                )}
              </div>
              <div className="bank-metrics">
                <div className="metric">
                  <span className="metric-label">Required</span>
                  <Computed value={required} />
                </div>
                <div className="metric">
                  <span className="metric-label">Actual</span>
                  <MoneyInput value={b.actual} onChange={v => updateRow('banks', b.id, { actual: v })} />
                </div>
                <div className="metric">
                  <span className="metric-label">Extra</span>
                  <Computed value={extra} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="hint">
        Required = unpaid bills tagged to that bank. The <strong>Default</strong> bank (set in Settings)
        also includes the remaining budget. Add, rename, or remove banks in <strong>Settings</strong>.
      </p>
    </Section>
  )
}
