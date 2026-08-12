import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { creditCardTotal } from '../lib/calc.js'
import { uid, monthStartDate } from '../lib/storage.js'
import { parseNumber, formatINR } from '../lib/format.js'
import { Computed, Section, IconButton } from './ui.jsx'
import { MoneyInput, TextInput } from './Inputs.jsx'
import { Modal } from './Modal.jsx'
import { useEditable } from '../context/EditModeContext.jsx'

const emptyDraft = () => ({ cardId: '', categoryId: '', date: '', amount: '', notes: '' })

// Credit Card Spends screen: pick a card (or all), see this month's spends in a
// table (Date · Category · Amount · Notes), and add a spend via the + FAB.
// Cards and categories are global master lists (settings); spends are per month.
export function CreditCardSpends({ month, settings, addRow, updateRow, deleteRow }) {
  const navigate = useNavigate()
  const cards = settings.creditCards || []
  const categories = [...(settings.spendCategories || [])].sort((a, b) => a.name.localeCompare(b.name))

  const [selectedCard, setSelectedCard] = useState('') // '' = all cards
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)

  const spends = (month.creditCards || []).filter(s => !selectedCard || s.cardId === selectedCard)
  const total = creditCardTotal(month, selectedCard)

  const cardName = id => cards.find(c => c.id === id)?.name || '(deleted)'
  const categoryName = id => categories.find(c => c.id === id)?.name || '(deleted)'

  function openModal() {
    setDraft({ ...emptyDraft(), cardId: selectedCard || cards[0]?.id || '', date: monthStartDate(month.id) })
    setModalOpen(true)
  }
  function closeModal() {
    setModalOpen(false)
  }
  function saveSpend() {
    if (!draft.cardId) return
    addRow('creditCards', {
      id: uid('ccs'),
      cardId: draft.cardId,
      categoryId: draft.categoryId,
      date: draft.date,
      amount: parseNumber(draft.amount),
      notes: draft.notes.trim(),
    })
    closeModal()
  }

  const canSave = !!draft.cardId

  return (
    <div className="spends-page">
      <Section
        title="Credit Card Spends"
        accent="#7c5cff"
        actions={
          cards.length > 0 && (
            <div className="spends-actions">
              <button
                className="mb-btn"
                onClick={() => navigate('/credit-cards/insights')}
              >
                📊 View insights
              </button>
              <select
                className="cell-input card-filter"
                value={selectedCard}
                onChange={e => setSelectedCard(e.target.value)}
                aria-label="Filter by card"
              >
                <option value="">All cards</option>
                {cards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )
        }
      >
        {cards.length === 0 ? (
          <p className="hint" style={{ marginTop: 0 }}>
            No credit cards yet. Add one in <strong>Settings → Credit Cards</strong> to start tracking spends.
          </p>
        ) : (
          <>
            <div className={`table spends-table ${selectedCard ? '' : 'with-card'}`}>
              <div className="thead">
                <span>Date</span>
                <span>Category</span>
                <span>Amount</span>
                <span>Notes</span>
                {selectedCard ? null : <span>Card</span>}
                <span />
              </div>
              {spends.map(s => (
                <div className="trow" key={s.id}>
                  <span data-label="Date">
                    <TextInput
                      type="date"
                      value={s.date}
                      onChange={v => updateRow('creditCards', s.id, { date: v })}
                    />
                  </span>
                  <span data-label="Category">
                    <CategorySelect
                      value={s.categoryId}
                      categories={categories}
                      display={categoryName(s.categoryId)}
                      onChange={v => updateRow('creditCards', s.id, { categoryId: v })}
                    />
                  </span>
                  <span data-label="Amount">
                    <MoneyInput
                      value={s.amount}
                      onChange={v => updateRow('creditCards', s.id, { amount: v })}
                    />
                  </span>
                  <span data-label="Notes">
                    <TextInput
                      value={s.notes}
                      placeholder="Notes"
                      onChange={v => updateRow('creditCards', s.id, { notes: v })}
                    />
                  </span>
                  {selectedCard ? null : (
                    <span data-label="Card" className="cell-display ro text">
                      {cardName(s.cardId)}
                    </span>
                  )}
                  <span className="row-actions">
                    <IconButton
                      label="Delete spend"
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`Delete this spend${s.notes ? ` "${s.notes}"` : ''} of ${formatINR(s.amount)}?`)) {
                          deleteRow('creditCards', s.id)
                        }
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
            {spends.length === 0 && (
              <p className="hint">
                No spends recorded for this month{selectedCard ? ' on this card' : ''} yet. Tap + to add one.
              </p>
            )}
            <div className="bills-footer">
              <div className="row total-row">
                <span>Total</span>
                <Computed value={total} strong />
              </div>
            </div>
          </>
        )}
      </Section>

      <button className="fab" aria-label="Add spend" onClick={openModal}>
        ＋
      </button>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Add credit card spend"
        footer={
          <>
            <button type="button" className="mb-btn" onClick={closeModal}>
              Cancel
            </button>
            <button type="button" className="mb-btn primary" onClick={saveSpend} disabled={!canSave}>
              Save
            </button>
          </>
        }
      >
        {cards.length === 0 ? (
          <p className="hint" style={{ marginTop: 0 }}>
            Add a credit card in <strong>Settings → Credit Cards</strong> first.
          </p>
        ) : (
          <>
            <div className="modal-field">
              <label htmlFor="spend-card">Credit card</label>
              <select
                id="spend-card"
                className="cell-input"
                value={draft.cardId}
                onChange={e => setDraft(d => ({ ...d, cardId: e.target.value }))}
              >
                {cards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label htmlFor="spend-category">Category</label>
              <select
                id="spend-category"
                className="cell-input"
                value={draft.categoryId}
                onChange={e => setDraft(d => ({ ...d, categoryId: e.target.value }))}
              >
                <option value="">— None —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label htmlFor="spend-amount">Amount</label>
              <input
                id="spend-amount"
                className="cell-input"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={draft.amount}
                onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))}
              />
            </div>
            <div className="modal-field">
              <label htmlFor="spend-date">Date</label>
              <input
                id="spend-date"
                className="cell-input"
                type="date"
                value={draft.date}
                onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
              />
            </div>
            <div className="modal-field">
              <label htmlFor="spend-notes">Notes</label>
              <input
                id="spend-notes"
                className="cell-input"
                type="text"
                placeholder="Optional"
                value={draft.notes}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

// Category cell: editable <select> in edit mode, static name when locked
// (mirrors the bank select-vs-span pattern in BillsEmis).
function CategorySelect({ value, categories, display, onChange }) {
  const editable = useEditable()
  if (!editable) return <span className="cell-display ro text">{display}</span>
  return (
    <select className="cell-input" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">—</option>
      {categories.map(c => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
