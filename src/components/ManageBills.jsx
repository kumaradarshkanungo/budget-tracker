import { useState } from 'react'
import { Section, IconButton } from './ui.jsx'
import { TextInput, MoneyInput } from './Inputs.jsx'
import { Modal } from './Modal.jsx'
import { SwipeToDelete } from './SwipeToDelete.jsx'
import { useEditable } from '../context/EditModeContext.jsx'
import { DEFAULT_BANK, labelForMonthId } from '../lib/storage.js'
import { parseNumber } from '../lib/format.js'

// "Manage Bills & EMIs" page: the master lists that seed each month — Recurring
// Bills & EMIs (loans, EMIs, SIPs, card payments), Recurring Incomes (salary,
// rent received, etc.), and EMIs (loans folded into a card's NEXT-month payable).
// Each list is its own card. A single ⟳ Sync button in the page header re-applies
// all three template lists to every already-created FUTURE month (bills preserve
// paid status + manually-entered amounts, incomes preserve their received flag,
// card payables recompute); the current and past months are left unchanged.
//
// Adding a row happens in a MODAL (one per list) that collects the fields and, on
// Add, creates the row via the same addRecurring* action; editing an existing row
// stays INLINE in the table. Read-only by default; the app-wide floating action
// button's Edit action unlocks the fields and reveals the add buttons (edit state
// comes from EditModeContext).
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
  addRecurringEmi,
  updateRecurringEmi,
  deleteRecurringEmi,
}) {
  const editable = useEditable()
  const banks = month?.banks || []
  const bankNames = Array.from(new Set(banks.map(b => b.name).filter(Boolean)))
  const cards = settings.creditCards || []
  const [syncMsg, setSyncMsg] = useState('')
  // The add-modal: `kind` selects which list we're adding to (null = closed);
  // `draft` holds the in-progress row. Editing existing rows stays inline, so the
  // inline edit/add helpers below only clear the stale sync confirmation.
  const [addKind, setAddKind] = useState(null) // 'bill' | 'income' | 'emi' | null
  const [draft, setDraft] = useState({})
  // Editing a template already re-syncs future months on its own; clear any stale
  // sync confirmation so it doesn't imply the edit was included in that message.
  const editTemplate = (id, patch) => { setSyncMsg(''); updateRecurringBill(id, patch) }
  const editIncome = (id, patch) => { setSyncMsg(''); updateRecurringIncome(id, patch) }
  const editEmi = (id, patch) => { setSyncMsg(''); updateRecurringEmi(id, patch) }
  // Show recurring bills ordered by day-of-month (ascending); templates without a
  // day sort last. Sorting a copy keeps the stored order untouched.
  const dayOf = r => {
    const d = Number(r.day)
    return Number.isFinite(d) && d > 0 ? d : Infinity
  }
  const recurringBills = [...(settings.recurringBills || [])].sort((a, b) => dayOf(a) - dayOf(b))
  const recurringIncomes = settings.recurringIncomes || []
  const recurringEmis = settings.recurringEmis || []

  function handleSync() {
    const n = syncRecurringNow ? syncRecurringNow() : 0
    setSyncMsg(n ? `✓ Synced ${n} month${n === 1 ? '' : 's'}` : 'Nothing to sync')
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

  function handleDeleteEmi(r) {
    if (window.confirm(`Delete EMI "${r.name || 'Unnamed'}"? Future months' card payables will be recalculated. Current and past months are unaffected.`)) {
      setSyncMsg('')
      deleteRecurringEmi(r.id)
    }
  }

  // ---- Add modal ---------------------------------------------------------
  // Open with a fresh draft matching the action defaults for that list.
  function openAdd(kind) {
    if (kind === 'bill') setDraft({ type: 'manual', day: '', name: '', cardId: '', bankName: '', amount: 0 })
    else if (kind === 'income') setDraft({ name: '', amount: 0, startMonth: '', endMonth: '' })
    else if (kind === 'emi') setDraft({ name: '', cardId: '', amount: 0, startMonth: '', endMonth: '' })
    setAddKind(kind)
  }
  function closeAdd() {
    setAddKind(null)
    setDraft({})
  }
  const setD = patch => setDraft(d => ({ ...d, ...patch }))

  function submitAdd() {
    setSyncMsg('')
    if (addKind === 'bill') {
      const isCard = draft.type === 'card'
      addRecurringBill({
        type: draft.type || 'manual',
        day: draft.day || '',
        // A card bill takes its name from the card and derives its amount from
        // prior-month spends — never carry a typed name/amount for it.
        name: isCard ? '' : (draft.name || ''),
        cardId: isCard ? (draft.cardId || '') : '',
        bankName: draft.bankName || '',
        amount: isCard ? 0 : parseNumber(draft.amount),
      })
    } else if (addKind === 'income') {
      addRecurringIncome({
        name: draft.name || '',
        amount: parseNumber(draft.amount),
        startMonth: draft.startMonth || '',
        endMonth: draft.endMonth || '',
      })
    } else if (addKind === 'emi') {
      addRecurringEmi({
        name: draft.name || '',
        cardId: draft.cardId || '',
        amount: parseNumber(draft.amount),
        startMonth: draft.startMonth || '',
        endMonth: draft.endMonth || '',
      })
    }
    closeAdd()
  }

  const addTitle = addKind === 'bill' ? 'Add recurring bill'
    : addKind === 'income' ? 'Add recurring income'
    : addKind === 'emi' ? 'Add EMI'
    : ''

  return (
    <div className="settings-page">
      <div className="settings-head">
        <h2>Manage Bills &amp; EMIs</h2>
        <div className="settings-head-actions">
          <button className="mb-btn" onClick={handleSync} title="Re-apply these templates to all months">
            ⟳ Sync
          </button>
        </div>
      </div>
      {syncMsg && <p className="sync-msg" role="status">{syncMsg}</p>}

      <Section title="Recurring Bills & EMIs">
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
              <SwipeToDelete key={r.id} onDelete={() => handleDeleteRecurring(r)} label="Delete">
              <div className="trow">
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
              </SwipeToDelete>
            )
          })}
          {recurringBills.length === 0 && <p className="hint">No recurring bills yet — add one below.</p>}
        </div>

        {editable && (
          <div className="add-bank-row">
            <button className="mb-btn" onClick={() => openAdd('bill')}>＋ Add recurring bill</button>
          </div>
        )}
      </Section>

      <Section title="Recurring Incomes">
        <div className="table incomes-table">
          <div className="thead">
            <span>Name</span>
            <span>Amount</span>
            <span>Start</span>
            <span>End</span>
            <span />
          </div>
          {recurringIncomes.map(r => (
            <SwipeToDelete key={r.id} onDelete={() => handleDeleteIncome(r)} label="Delete">
            <div className="trow">
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
              <span data-label="Start">
                {editable ? (
                  <span className="month-field">
                    <input
                      type="month"
                      className="cell-input"
                      value={r.startMonth || ''}
                      onChange={e => editIncome(r.id, { startMonth: e.target.value })}
                    />
                    {r.startMonth && (
                      <button
                        type="button"
                        className="month-clear"
                        aria-label="Clear start month"
                        title="Clear start month"
                        onClick={() => editIncome(r.id, { startMonth: '' })}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="cell-display ro text">
                    {r.startMonth ? labelForMonthId(r.startMonth) : '—'}
                  </span>
                )}
              </span>
              <span data-label="End">
                {editable ? (
                  <span className="month-field">
                    <input
                      type="month"
                      className="cell-input"
                      value={r.endMonth || ''}
                      onChange={e => editIncome(r.id, { endMonth: e.target.value })}
                    />
                    {r.endMonth && (
                      <button
                        type="button"
                        className="month-clear"
                        aria-label="Clear end month"
                        title="Clear end month"
                        onClick={() => editIncome(r.id, { endMonth: '' })}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="cell-display ro text">
                    {r.endMonth ? labelForMonthId(r.endMonth) : '—'}
                  </span>
                )}
              </span>
              <span className="row-actions">
                <IconButton label="Delete recurring income" variant="danger" onClick={() => handleDeleteIncome(r)} />
              </span>
            </div>
            </SwipeToDelete>
          ))}
          {recurringIncomes.length === 0 && <p className="hint">No recurring incomes yet — add one below.</p>}
        </div>

        {editable && (
          <div className="add-bank-row">
            <button className="mb-btn" onClick={() => openAdd('income')}>＋ Add recurring income</button>
          </div>
        )}
      </Section>

      <Section title="EMIs">
        <p className="hint" style={{ marginTop: 0 }}>
          An EMI linked to a credit card is added to that card&rsquo;s payable in the <strong>next</strong> month&rsquo;s
          Bills &amp; EMIs (it is not counted as a spend in its own month). Unlinked EMIs are listed here for reference only.
        </p>

        <div className="table emis-table">
          <div className="thead">
            <span>Name</span>
            <span>Credit card</span>
            <span>Amount</span>
            <span>Start</span>
            <span>End</span>
            <span />
          </div>
          {recurringEmis.map(r => {
            const cardLabel = r.cardId ? (cards.find(c => c.id === r.cardId)?.name || '(deleted)') : '—'
            return (
              <SwipeToDelete key={r.id} onDelete={() => handleDeleteEmi(r)} label="Delete">
              <div className="trow">
                <span data-label="Name">
                  <TextInput
                    value={r.name}
                    placeholder="Name"
                    onChange={v => editEmi(r.id, { name: v })}
                  />
                </span>
                <span data-label="Credit card">
                  {editable ? (
                    <select
                      className="cell-input"
                      value={r.cardId || ''}
                      onChange={e => editEmi(r.id, { cardId: e.target.value })}
                    >
                      <option value="">— None —</option>
                      {cards.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="cell-display ro text">{cardLabel}</span>
                  )}
                </span>
                <span data-label="Amount">
                  <MoneyInput value={r.amount} onChange={v => editEmi(r.id, { amount: v })} />
                </span>
                <span data-label="Start">
                  {editable ? (
                    <span className="month-field">
                      <input
                        type="month"
                        className="cell-input"
                        value={r.startMonth || ''}
                        onChange={e => editEmi(r.id, { startMonth: e.target.value })}
                      />
                      {r.startMonth && (
                        <button
                          type="button"
                          className="month-clear"
                          aria-label="Clear start month"
                          title="Clear start month"
                          onClick={() => editEmi(r.id, { startMonth: '' })}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ) : (
                    <span className="cell-display ro text">
                      {r.startMonth ? labelForMonthId(r.startMonth) : '—'}
                    </span>
                  )}
                </span>
                <span data-label="End">
                  {editable ? (
                    <span className="month-field">
                      <input
                        type="month"
                        className="cell-input"
                        value={r.endMonth || ''}
                        onChange={e => editEmi(r.id, { endMonth: e.target.value })}
                      />
                      {r.endMonth && (
                        <button
                          type="button"
                          className="month-clear"
                          aria-label="Clear end month"
                          title="Clear end month"
                          onClick={() => editEmi(r.id, { endMonth: '' })}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ) : (
                    <span className="cell-display ro text">
                      {r.endMonth ? labelForMonthId(r.endMonth) : '—'}
                    </span>
                  )}
                </span>
                <span className="row-actions">
                  <IconButton label="Delete EMI" variant="danger" onClick={() => handleDeleteEmi(r)} />
                </span>
              </div>
              </SwipeToDelete>
            )
          })}
          {recurringEmis.length === 0 && <p className="hint">No EMIs yet — add one below.</p>}
        </div>

        {editable && (
          <div className="add-bank-row">
            <button className="mb-btn" onClick={() => openAdd('emi')}>＋ Add EMI</button>
          </div>
        )}
      </Section>

      <Modal
        open={!!addKind}
        onClose={closeAdd}
        title={addTitle}
        footer={
          <>
            <button type="button" className="mb-btn" onClick={closeAdd}>Cancel</button>
            <button type="button" className="mb-btn primary" onClick={submitAdd}>Add</button>
          </>
        }
      >
        {addKind === 'bill' && (
          <>
            <div className="modal-field">
              <label>Type</label>
              <select value={draft.type || 'manual'} onChange={e => setD({ type: e.target.value })}>
                <option value="manual">Manual</option>
                <option value="card">Credit card</option>
              </select>
            </div>
            <div className="modal-field">
              <label>Day of month</label>
              <select value={draft.day || ''} onChange={e => setD({ day: e.target.value })}>
                <option value="">—</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            {draft.type === 'card' ? (
              <div className="modal-field">
                <label>Credit card</label>
                <select value={draft.cardId || ''} onChange={e => setD({ cardId: e.target.value })}>
                  <option value="">—</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="hint" style={{ margin: 0 }}>
                  The amount is filled in automatically from the card&rsquo;s previous-month spends.
                </p>
              </div>
            ) : (
              <div className="modal-field">
                <label>Name</label>
                <input
                  type="text"
                  value={draft.name || ''}
                  placeholder="Name"
                  onChange={e => setD({ name: e.target.value })}
                />
              </div>
            )}
            <div className="modal-field">
              <label>Bank</label>
              <select value={draft.bankName || ''} onChange={e => setD({ bankName: e.target.value })}>
                <option value="">—</option>
                <option value={DEFAULT_BANK}>Default bank</option>
                {bankNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            {draft.type !== 'card' && (
              <div className="modal-field">
                <label>Amount</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.amount ?? ''}
                  placeholder="0"
                  onChange={e => setD({ amount: e.target.value })}
                />
              </div>
            )}
          </>
        )}

        {addKind === 'income' && (
          <>
            <div className="modal-field">
              <label>Name</label>
              <input
                type="text"
                value={draft.name || ''}
                placeholder="Name"
                onChange={e => setD({ name: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={draft.amount ?? ''}
                placeholder="0"
                onChange={e => setD({ amount: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Start month</label>
              <input type="month" value={draft.startMonth || ''} onChange={e => setD({ startMonth: e.target.value })} />
            </div>
            <div className="modal-field">
              <label>End month</label>
              <input type="month" value={draft.endMonth || ''} onChange={e => setD({ endMonth: e.target.value })} />
            </div>
          </>
        )}

        {addKind === 'emi' && (
          <>
            <div className="modal-field">
              <label>Name</label>
              <input
                type="text"
                value={draft.name || ''}
                placeholder="Name"
                onChange={e => setD({ name: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Credit card</label>
              <select value={draft.cardId || ''} onChange={e => setD({ cardId: e.target.value })}>
                <option value="">— None —</option>
                {cards.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label>Amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={draft.amount ?? ''}
                placeholder="0"
                onChange={e => setD({ amount: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Start month</label>
              <input type="month" value={draft.startMonth || ''} onChange={e => setD({ startMonth: e.target.value })} />
            </div>
            <div className="modal-field">
              <label>End month</label>
              <input type="month" value={draft.endMonth || ''} onChange={e => setD({ endMonth: e.target.value })} />
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
