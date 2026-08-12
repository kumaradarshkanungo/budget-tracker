import { useState } from 'react'
import { Section, IconButton } from './ui.jsx'
import { TextInput } from './Inputs.jsx'
import { BackupSection } from './BackupSection.jsx'
import { useEditable } from '../context/EditModeContext.jsx'

// Settings page: manage banks (add / rename / delete) and pick the default bank.
// The Default Bank is the single source of truth for which bank is "primary" —
// choosing one marks it primary on the current month and on any months created
// afterwards. Previous months keep whatever primary they already had. Read-only
// by default; the app-wide floating action button's Edit action unlocks the
// fields (edit state comes from EditModeContext).
export function Settings({
  month,
  months,
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
  exportSelectionJSON,
  importJSON,
  onClose,
}) {
  const editable = useEditable()
  const [newBank, setNewBank] = useState('')
  const [newCard, setNewCard] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const banks = month.banks || []
  const bankNames = Array.from(new Set(banks.map(b => b.name).filter(Boolean)))
  const cards = settings.creditCards || []
  const categories = [...(settings.spendCategories || [])].sort((a, b) => a.name.localeCompare(b.name))

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

  return (
    <div className="settings-page">
      <div className="settings-head">
        <h2>Settings</h2>
        <div className="settings-head-actions">
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

      <BackupSection
        months={months}
        exportSelectionJSON={exportSelectionJSON}
        importJSON={importJSON}
      />

      <Section title="More settings">
        <p className="hint" style={{ marginTop: 0 }}>
          More options will appear here as the app grows (currency, default categories, reminders, etc.).
        </p>
      </Section>
    </div>
  )
}
