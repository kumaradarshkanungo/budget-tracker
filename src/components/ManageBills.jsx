import { Section, IconButton } from './ui.jsx'
import { TextInput, MoneyInput } from './Inputs.jsx'

// "Manage Bills & EMIs" page: the master list of repeated bills & EMIs that seed
// each month's Bills & EMIs. Set the day, name/card, bank and amount once; the
// year and month are filled in automatically. Type "Credit card" names the bill
// after a card and prefetches its amount from the previous month's card spends.
// Editing a template here re-syncs it into every already-created FUTURE month
// (preserving paid status and manually-entered amounts); the current and past
// months are left unchanged. Read-only by default; a page-level Edit toggle
// (rendered in the header) unlocks the fields.
export function ManageBills({
  month,
  settings,
  addRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
  editable,
  onToggleEdit,
  onClose,
}) {
  const banks = month?.banks || []
  const bankNames = Array.from(new Set(banks.map(b => b.name).filter(Boolean)))
  const cards = settings.creditCards || []
  const recurringBills = settings.recurringBills || []

  function handleDeleteRecurring(r) {
    if (window.confirm(`Delete repeated bill "${r.name || 'Unnamed'}"? It will be removed from future months. Current and past months are unaffected.`)) {
      deleteRecurringBill(r.id)
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

      <Section title="Repeated Bills & EMIs">
        <p className="hint section-intro">
          Bills that repeat every month (loans, EMIs, SIPs). Set the <strong>day</strong>, name, bank
          and amount once — the year and month are filled in automatically. Set <strong>Type</strong> to
          <strong> Credit card</strong> to name the bill after a card and prefetch its amount from the
          previous month's card spends (still editable). Changes here update
          <strong> future months automatically</strong>; the current and past months are left unchanged.
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
                      onChange={e => updateRecurringBill(r.id, { type: e.target.value })}
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
                      onChange={e => updateRecurringBill(r.id, { day: e.target.value })}
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
                        onChange={e => updateRecurringBill(r.id, { cardId: e.target.value })}
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
                      onChange={v => updateRecurringBill(r.id, { name: v })}
                    />
                  )}
                </span>
                <span data-label="Bank">
                  {editable ? (
                    <select
                      className="cell-input"
                      value={r.bankName || ''}
                      onChange={e => updateRecurringBill(r.id, { bankName: e.target.value })}
                    >
                      <option value="">—</option>
                      {bankNames.map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="cell-display ro text">{r.bankName || '—'}</span>
                  )}
                </span>
                <span data-label="Amount">
                  <MoneyInput
                    value={r.amount}
                    placeholder={isCard ? 'Bill amount' : ''}
                    onChange={v => updateRecurringBill(r.id, { amount: v })}
                  />
                </span>
                <span className="row-actions">
                  <IconButton label="Delete repeated bill" variant="danger" onClick={() => handleDeleteRecurring(r)} />
                </span>
              </div>
            )
          })}
          {recurringBills.length === 0 && <p className="hint">No repeated bills yet — add one below.</p>}
        </div>

        {editable && (
          <div className="add-bank-row">
            <button className="mb-btn" onClick={() => addRecurringBill()}>＋ Add repeated bill</button>
          </div>
        )}
      </Section>
    </div>
  )
}
