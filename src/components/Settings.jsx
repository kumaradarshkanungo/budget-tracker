import { useState } from 'react'
import { Section, IconButton } from './ui.jsx'
import { TextInput, MoneyInput } from './Inputs.jsx'

// Settings page: manage banks (add / rename / delete) and pick the default bank.
// The Default Bank is the single source of truth for which bank is "primary" —
// choosing one marks it primary on the current month and on any months created
// afterwards. Previous months keep whatever primary they already had.
export function Settings({
  month,
  settings,
  addBank,
  renameBank,
  deleteBank,
  setDefaultBank,
  addCard,
  deleteCard,
  addSpendCategory,
  renameSpendCategory,
  deleteSpendCategory,
  addRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
  editable,
  onToggleEdit,
  onClose,
}) {
  const [newBank, setNewBank] = useState('')
  const [newCard, setNewCard] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const banks = month.banks || []
  const bankNames = Array.from(new Set(banks.map(b => b.name).filter(Boolean)))
  const cards = settings.creditCards || []
  const categories = [...(settings.spendCategories || [])].sort((a, b) => a.name.localeCompare(b.name))
  const recurringBills = settings.recurringBills || []

  function handleAdd() {
    const name = newBank.trim()
    if (!name) return
    addBank(name)
    setNewBank('')
  }
  function handleDelete(b) {
    if (window.confirm(`Delete bank "${b.name || 'Unnamed'}"? Bills tagged to it will be untagged.`)) {
      deleteBank(b.id)
    }
  }
  function handleAddCard() {
    const name = newCard.trim()
    if (!name) return
    addCard(name)
    setNewCard('')
  }
  function handleDeleteCard(c) {
    if (window.confirm(`Delete card "${c.name || 'Unnamed'}"? Past spends stay but show the card as removed.`)) {
      deleteCard(c.id)
    }
  }
  function handleAddCategory() {
    const name = newCategory.trim()
    if (!name) return
    addSpendCategory(name)
    setNewCategory('')
  }
  function handleDeleteCategory(cat) {
    if (window.confirm(`Delete category "${cat.name || 'Unnamed'}"? Spends using it will show it as removed.`)) {
      deleteSpendCategory(cat.id)
    }
  }
  function handleDeleteRecurring(r) {
    if (window.confirm(`Delete repeated bill "${r.name || 'Unnamed'}"? Future months won't include it. Existing months are unaffected.`)) {
      deleteRecurringBill(r.id)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-head">
        <h2>Settings</h2>
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

      <Section title="Banks">
        <p className="hint section-intro">
          Banks appear in the <strong>Bank Balance</strong> section and as options when tagging bills.
          The <strong>Default Bank</strong> (below) receives the remaining budget in its Required amount.
        </p>

        <div className="bank-manage-list">
          {banks.map(b => (
            <div className="bank-manage-row" key={b.id}>
              <TextInput
                value={b.name}
                placeholder="Bank name"
                onChange={v => renameBank(b.id, v)}
                className="bank-name"
              />
              {b.primary && <span className="primary-tag" title="Default bank — gets the remaining budget added to its Required">Default</span>}
              <IconButton label="Delete bank" variant="danger" onClick={() => handleDelete(b)} />
            </div>
          ))}
          {banks.length === 0 && <p className="hint">No banks yet — add one below.</p>}
        </div>

        {editable && (
          <div className="add-bank-row">
            <TextInput
              value={newBank}
              placeholder="New bank name"
              onChange={setNewBank}
            />
            <button className="mb-btn" onClick={handleAdd} disabled={!newBank.trim()}>＋ Add bank</button>
          </div>
        )}
      </Section>

      <Section title="Default Bank">
        <p className="hint" style={{ marginTop: 0 }}>
          The default bank is marked <strong>Primary</strong> and receives the remaining budget in its
          Required amount. Changing it updates <strong>this month and future months</strong> — previous
          months keep their own default.
        </p>
        <div className="setting-row">
          <label htmlFor="defaultBank">Default bank</label>
          {editable ? (
            <select
              id="defaultBank"
              className="cell-input"
              value={settings.defaultBankName || ''}
              onChange={e => setDefaultBank(e.target.value)}
            >
              <option value="">— None —</option>
              {bankNames.map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <span className="cell-display ro text">{settings.defaultBankName || '— None —'}</span>
          )}
        </div>
      </Section>

      <Section title="Credit Cards">
        <p className="hint section-intro">
          Credit cards are shared across all months and appear as options on the
          <strong> Credit Card Spends</strong> screen.
        </p>
        <div className="bank-manage-list">
          {cards.map(c => (
            <div className="bank-manage-row" key={c.id}>
              <span className="bank-name">{c.name}</span>
              <IconButton label="Delete card" variant="danger" onClick={() => handleDeleteCard(c)} />
            </div>
          ))}
          {cards.length === 0 && <p className="hint">No cards yet — add one below.</p>}
        </div>
        {editable && (
          <div className="add-bank-row">
            <TextInput value={newCard} placeholder="New card name" onChange={setNewCard} />
            <button className="mb-btn" onClick={handleAddCard} disabled={!newCard.trim()}>＋ Add card</button>
          </div>
        )}
      </Section>

      <Section title="Spend Categories">
        <p className="hint section-intro">
          Categories used to tag credit card spends. Renaming a category updates it on
          every spend that uses it.
        </p>
        <div className="bank-manage-list">
          {categories.map(cat => (
            <div className="bank-manage-row" key={cat.id}>
              <TextInput
                value={cat.name}
                placeholder="Category name"
                onChange={v => renameSpendCategory(cat.id, v)}
                className="bank-name"
              />
              <IconButton label="Delete category" variant="danger" onClick={() => handleDeleteCategory(cat)} />
            </div>
          ))}
          {categories.length === 0 && <p className="hint">No categories yet — add one below.</p>}
        </div>
        {editable && (
          <div className="add-bank-row">
            <TextInput value={newCategory} placeholder="New category name" onChange={setNewCategory} />
            <button className="mb-btn" onClick={handleAddCategory} disabled={!newCategory.trim()}>＋ Add category</button>
          </div>
        )}
      </Section>

      <Section title="Repeated Bills & EMIs">
        <p className="hint section-intro">
          Bills that repeat every month (loans, EMIs, SIPs). Set the <strong>day</strong>, name, bank
          and amount once — the year and month are filled in automatically. Set <strong>Type</strong> to
          <strong> Credit card</strong> to name the bill after a card and prefetch its amount from the
          previous month's card spends (still editable). These are added
          <strong> automatically to new months you create</strong>; existing months are left unchanged.
        </p>
        <div className="recurring-list">
          {recurringBills.map(r => {
            const isCard = r.type === 'card'
            const cardName = isCard ? (cards.find(c => c.id === r.cardId)?.name || '—') : ''
            return (
            <div className="recurring-row" key={r.id}>
              <span className="rec-field" data-label="Type">
                <span className="rec-label">Type</span>
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
              <span className="rec-field" data-label="Day">
                <span className="rec-label">Day</span>
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
              {isCard ? (
                <span className="rec-field" data-label="Card">
                  <span className="rec-label">Card</span>
                  {editable ? (
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
                  )}
                </span>
              ) : (
                <span className="rec-field" data-label="Name">
                  <span className="rec-label">Name</span>
                  <TextInput
                    value={r.name}
                    placeholder="Name"
                    onChange={v => updateRecurringBill(r.id, { name: v })}
                  />
                </span>
              )}
              <span className="rec-field" data-label="Bank">
                <span className="rec-label">Bank</span>
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
              <span className="rec-field" data-label="Amount">
                <span className="rec-label">Amount</span>
                <MoneyInput value={r.amount} onChange={v => updateRecurringBill(r.id, { amount: v })} />
              </span>
              <span className="rec-actions">
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

      <Section title="More settings">
        <p className="hint" style={{ marginTop: 0 }}>
          More options will appear here as the app grows (currency, default categories, reminders, etc.).
        </p>
      </Section>
    </div>
  )
}
