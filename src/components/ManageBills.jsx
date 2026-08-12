import { useState } from 'react'
import { Section, IconButton } from './ui.jsx'
import { TextInput, MoneyInput } from './Inputs.jsx'
import { DEFAULT_BANK } from '../lib/storage.js'

// "Manage Bills & EMIs" page: the master lists that seed each month — Recurring
// Bills & EMIs (loans, EMIs, SIPs, card payments) and Recurring Incomes (salary,
// rent received, etc.). Both live in one "Recurring Bills & Incomes" section with
// a single ⟳ Sync future months button. Set a bill's day/name/bank/amount once
// (year+month are filled in automatically); a recurring income needs only a name
// and amount. Editing a template here re-syncs it into every already-created
// FUTURE month — bills preserve paid status and manually-entered amounts; incomes
// preserve their checked (received) flag; the current and past months are left
// unchanged. Read-only by default; a page-level Edit toggle unlocks the fields.
export function ManageBills({
  month,
  settings,
  addRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
  syncRecurringNow,
  addRecurringIncome,
  updateRecurringIncome,
  deleteRecurringIncome,
  editable,
  onToggleEdit,
  onClose,
}) {
  const banks = month?.banks || []
  const bankNames = Array.from(new Set(banks.map(b => b.name).filter(Boolean)))
  const cards = settings.creditCards || []
  const [syncMsg, setSyncMsg] = useState('')
  // Editing a template already re-syncs future months on its own; clear any stale
  // sync confirmation so it doesn't imply the edit was included in that message.
  const editTemplate = (id, patch) => { setSyncMsg(''); updateRecurringBill(id, patch) }
  const addTemplate = () => { setSyncMsg(''); addRecurringBill() }
  const editIncome = (id, patch) => { setSyncMsg(''); updateRecurringIncome(id, patch) }
  const addIncome = () => { setSyncMsg(''); addRecurringIncome() }
  // Show recurring bills ordered by day-of-month (ascending); templates without a
  // day sort last. Sorting a copy keeps the stored order untouched.
  const dayOf = r => {
    const d = Number(r.day)
    return Number.isFinite(d) && d > 0 ? d : Infinity
  }
  const recurringBills = [...(settings.recurringBills || [])].sort((a, b) => dayOf(a) - dayOf(b))
  const recurringIncomes = settings.recurringIncomes || []

  function handleSync() {
    const n = syncRecurringNow ? syncRecurringNow() : 0
    setSyncMsg(n ? `✓ Synced ${n} future month${n === 1 ? '' : 's'}` : 'No future months to sync')
  }

  function handleDeleteRecurring(r) {
    if (window.confirm(`Delete recurring bill "${r.name || 'Unnamed'}"? It will be removed from future months. Current and past months are unaffected.`)) {
      setSyncMsg('')
      deleteRecurringBill(r.id)
    }
  }

  function handleDeleteIncome(r) {
    if (window.confirm(`Delete recurring income "${r.name || 'Unnamed'}"? It will be removed from future months. Current and past months are unaffected.`)) {
      setSyncMsg('')
      deleteRecurringIncome(r.id)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-head">
        <h2>Manage Bills &amp; EMIs</h2>
        <div className="settings-head-actions">
          <button
            className={`mb-btn ${editable ? 'primary' : ''}`}
            aria-pressed={editable}
            onClick={onToggleEdit}
          >
            {editable ? '✓ Done' : '✎ Edit'}
          </button>
          <button className="mb-btn" onClick={onClose}>← Back</button>
        </div>
      </div>

      <Section
        title="Recurring Bills & Incomes"
        actions={
          <button className="mb-btn" onClick={handleSync} title="Re-apply these templates to all future months">
            ⟳ Sync future months
          </button>
        }
      >
        <p className="hint section-intro">
          Bills and incomes that repeat every month. Changes here update
          <strong> future months automatically</strong>; the current and past months are left unchanged.
          Use <strong>⟳ Sync future months</strong> to re-apply everything now — handy after editing
          credit-card spends that feed card-type bill amounts. Your paid marks, manually edited bill
          amounts, and received-income ticks are always preserved.
        </p>
        {syncMsg && <p className="sync-msg" role="status">{syncMsg}</p>}

        <h3 className="mb-subhead">Recurring Bills &amp; EMIs</h3>
        <p className="hint">
          Bills that repeat every month (loans, EMIs, SIPs). Set the <strong>day</strong>, name, bank
          and amount once — the year and month are filled in automatically. Set <strong>Type</strong> to
          <strong> Credit card</strong> to name the bill after a card and prefetch its amount from the
          previous month's card spends (still editable).
        </p>

        <div className="table manage-table">
          <div className="thead">
            <span>Type</span>
            <span>Day</span>
            <span>Name</span>
            <span>Bank</span>
            <span>Amount</span>
            <span />
          </div>
          {recurringBills.map(r => {
            const isCard = r.type === 'card'
            const cardName = isCard ? (cards.find(c => c.id === r.cardId)?.name || '—') : ''
            return (
              <div className="trow" key={r.id}>
                <span data-label="Type">
                  {editable ? (
                    <select
                      className="cell-input"
                      value={r.type || 'manual'}
                      onChange={e => editTemplate(r.id, { type: e.target.value })}
                    >
                      <option value="manual">Manual</option>
                      <option value="card">Credit card</option>
                    </select>
                  ) : (
                    <span className="cell-display ro text">{isCard ? 'Credit card' : 'Manual'}</span>
                  )}
                </span>
                <span data-label="Day">
                  {editable ? (
                    <select
                      className="cell-input"
                      value={r.day || ''}
                      onChange={e => editTemplate(r.id, { day: e.target.value })}
                    >
                      <option value="">—</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="cell-display ro text">{r.day || '—'}</span>
                  )}
                </span>
                <span data-label={isCard ? 'Card' : 'Name'}>
                  {isCard ? (
                    editable ? (
                      <select
                        className="cell-input"
                        value={r.cardId || ''}
                        onChange={e => editTemplate(r.id, { cardId: e.target.value })}
                      >
                        <option value="">—</option>
                        {cards.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="cell-display ro text">{cardName}</span>
                    )
                  ) : (
                    <TextInput
                      value={r.name}
                      placeholder="Name"
                      onChange={v => editTemplate(r.id, { name: v })}
                    />
                  )}
                </span>
                <span data-label="Bank">
                  {editable ? (
                    <select
                      className="cell-input"
                      value={r.bankName || ''}
                      onChange={e => editTemplate(r.id, { bankName: e.target.value })}
                    >
                      <option value="">—</option>
                      <option value={DEFAULT_BANK}>Default bank</option>
                      {bankNames.map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="cell-display ro text">
                      {r.bankName === DEFAULT_BANK ? 'Default bank' : (r.bankName || '—')}
                    </span>
                  )}
                </span>
                <span data-label="Amount">
                  <MoneyInput
                    value={r.amount}
                    placeholder={isCard ? 'Bill amount' : ''}
                    onChange={v => editTemplate(r.id, { amount: v })}
                  />
                </span>
                <span className="row-actions">
                  <IconButton label="Delete recurring bill" variant="danger" onClick={() => handleDeleteRecurring(r)} />
                </span>
              </div>
            )
          })}
          {recurringBills.length === 0 && <p className="hint">No recurring bills yet — add one below.</p>}
        </div>

        {editable && (
          <div className="add-bank-row">
            <button className="mb-btn" onClick={() => addTemplate()}>＋ Add recurring bill</button>
          </div>
        )}

        <h3 className="mb-subhead">Recurring Incomes</h3>
        <p className="hint">
          Incomes that arrive every month (salary, rent received). Each shows up as an entry in that
          month's <strong>Total Balance</strong>, unticked — counted in Total Available as money yet to
          receive. Once it lands, add it to the relevant <strong>bank's actual balance</strong> and then
          <strong> tick it</strong> in Total Balance so it isn't counted twice.
        </p>

        <div className="table incomes-table">
          <div className="thead">
            <span>Name</span>
            <span>Amount</span>
            <span />
          </div>
          {recurringIncomes.map(r => (
            <div className="trow" key={r.id}>
              <span data-label="Name">
                <TextInput
                  value={r.name}
                  placeholder="Name"
                  onChange={v => editIncome(r.id, { name: v })}
                />
              </span>
              <span data-label="Amount">
                <MoneyInput value={r.amount} onChange={v => editIncome(r.id, { amount: v })} />
              </span>
              <span className="row-actions">
                <IconButton label="Delete recurring income" variant="danger" onClick={() => handleDeleteIncome(r)} />
              </span>
            </div>
          ))}
          {recurringIncomes.length === 0 && <p className="hint">No recurring incomes yet — add one below.</p>}
        </div>

        {editable && (
          <div className="add-bank-row">
            <button className="mb-btn" onClick={() => addIncome()}>＋ Add recurring income</button>
          </div>
        )}
      </Section>
    </div>
  )
}
