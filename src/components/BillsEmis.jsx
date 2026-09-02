import { useEffect, useRef, useState } from 'react'
import { billsTotal, billsPending, billsCount } from '../lib/calc.js'
import { uid } from '../lib/storage.js'
import { Computed, Section, IconButton } from './ui.jsx'
import { MoneyInput, TextInput } from './Inputs.jsx'
import { SwipeToDelete } from './SwipeToDelete.jsx'
import { useEditable } from '../context/EditModeContext.jsx'

// Small popover menu behind the "＋ Add bill" button: add a blank bill, or a bill
// from a credit card (name auto-filled, amount prefetched from the prior month).
function AddBillMenu({ cards, onAddBlank, onAddCard }) {
  const [open, setOpen] = useState(false)
  const [pickCard, setPickCard] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setPickCard(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <span className="add-bill-menu" ref={ref}>
      <IconButton label="Add bill" onClick={() => { setOpen(o => !o); setPickCard(false) }} />
      {open && (
        <div className="add-bill-pop" role="menu">
          {!pickCard ? (
            <>
              <button
                className="add-bill-item"
                onClick={() => { onAddBlank(); setOpen(false) }}
              >
                Blank bill
              </button>
              <button
                className="add-bill-item"
                disabled={!cards.length}
                onClick={() => setPickCard(true)}
              >
                From credit card {cards.length ? '▸' : ''}
              </button>
              {!cards.length && <p className="hint add-bill-hint">No credit cards — add one in Settings.</p>}
            </>
          ) : (
            <>
              <div className="add-bill-menu-head">Pick a card</div>
              {cards.map(c => (
                <button
                  key={c.id}
                  className="add-bill-item"
                  onClick={() => { onAddCard(c.id); setOpen(false); setPickCard(false) }}
                >
                  {c.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </span>
  )
}

// Bills & EMIs — date, name, bank tag, amount, paid checkbox.
export function BillsEmis({ month, settings, addRow, updateRow, deleteRow, addCardBill, resetBillToAuto }) {
  const editable = useEditable()
  const total = billsTotal(month)
  const pending = billsPending(month)
  const { paid, total: count } = billsCount(month)
  const banks = month.banks || []
  const cards = (settings && settings.creditCards) || []
  // Show bills ordered by their day-of-month (ascending). Bills without a date
  // sort last. A stable sort keeps insertion order among equal days.
  const dayOf = b => {
    const d = Number(String(b.date || '').split('-')[2])
    return Number.isFinite(d) && d > 0 ? d : Infinity
  }
  const bills = [...(month.bills || [])].sort((a, b) => dayOf(a) - dayOf(b))

  return (
    <Section
      title="Bills & EMIs"
      accent="#f0a92e"
      actions={
        <AddBillMenu
          cards={cards}
          onAddBlank={() =>
            addRow('bills', {
              id: uid('b'),
              date: '',
              name: '',
              bankId: banks[0]?.id || '',
              amount: 0,
              paid: false,
            })
          }
          onAddCard={cardId => addCardBill && addCardBill(cardId)}
        />
      }
    >
      <div className="table bills-table">
        <div className="thead">
          <span>Date</span>
          <span>Name</span>
          <span>Bank</span>
          <span>Amount</span>
          <span>Paid</span>
          <span />
        </div>
        {bills.map(b => {
          const removeRow = () => {
            if (window.confirm(`Delete "${b.name || 'this bill'}"?`)) deleteRow('bills', b.id)
          }
          return (
          <SwipeToDelete key={b.id} onDelete={removeRow}>
          <div className={`trow ${b.paid ? 'is-paid' : ''}`}>
            <span data-label="Date">
              <TextInput
                type="date"
                value={b.date}
                onChange={v => updateRow('bills', b.id, { date: v })}
              />
            </span>
            <span data-label="Name">
              <TextInput
                value={b.name}
                placeholder="Name"
                onChange={v => updateRow('bills', b.id, { name: v })}
              />
            </span>
            <span data-label="Bank">
              {editable ? (
                <select
                  className="cell-input"
                  value={b.bankId}
                  onChange={e => updateRow('bills', b.id, { bankId: e.target.value })}
                >
                  <option value="">—</option>
                  {banks.map(bk => (
                    <option key={bk.id} value={bk.id}>
                      {bk.name || 'Bank'}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="cell-display ro text">
                  {banks.find(bk => bk.id === b.bankId)?.name || '—'}
                </span>
              )}
            </span>
            <span data-label="Amount">
              <span className="amount-cell">
                <MoneyInput
                  value={b.amount}
                  onChange={v =>
                    updateRow('bills', b.id, { amount: v, ...(b.rbId ? { amountAuto: false } : {}) })
                  }
                />
                {editable && b.rbId && b.amountAuto === false && resetBillToAuto && (
                  <button
                    type="button"
                    className="revert-btn"
                    title="Reset to calculated amount (from this card's prior-month spends)"
                    aria-label="Reset to calculated amount"
                    onClick={() => resetBillToAuto(b.id)}
                  >
                    ↺
                  </button>
                )}
              </span>
            </span>
            <span data-label="Paid" className="paid-cell">
              <input
                type="checkbox"
                checked={!!b.paid}
                onChange={e => updateRow('bills', b.id, { paid: e.target.checked })}
              />
            </span>
            <span className="row-actions">
              <IconButton label="Delete" variant="danger" onClick={removeRow} />
            </span>
          </div>
          </SwipeToDelete>
          )
        })}
      </div>
      <div className="bills-footer">
        <div className="row total-row">
          <span>Total</span>
          <Computed value={total} strong />
        </div>
        <div className="row total-row">
          <span>Amount Pending</span>
          <span className="pending-wrap">
            <span className="count-badge">{paid}/{count}</span>
            <Computed value={pending} strong />
          </span>
        </div>
      </div>
    </Section>
  )
}
