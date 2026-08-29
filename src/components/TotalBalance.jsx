import { useState } from 'react'
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
//
// DISPLAY ORDER (this table only): checked holdings are struck through and sink
// to the bottom, unchecked ones stay on top — a STABLE partition, so within each
// group the stored array order is kept. Because we only re-sort for DISPLAY (the
// stored `month.holdings` order is untouched by checking), unchecking a holding
// returns it to its original slot for free. Drag-and-drop rewrites that stored
// order via reorderRow, so a manual arrangement persists.
export function TotalBalance({ month, addRow, updateRow, deleteRow, reorderRow }) {
  const total = totalAvailable(month)
  const bankBalance = totalBankBalance(month)
  const [dragId, setDragId] = useState(null) // holding id being dragged, or null
  const [overId, setOverId] = useState(null) // holding id currently dragged over

  // Stable display order: keep the stored array order, then float checked rows to
  // the bottom. Array.prototype.sort is stable in modern engines, so equal keys
  // (same `excluded`) preserve their relative (stored) order.
  const holdings = (month.holdings || [])
    .map((h, i) => ({ h, i }))
    .sort((a, b) => Number(!!a.h.excluded) - Number(!!b.h.excluded) || a.i - b.i)
    .map(x => x.h)

  // Don't start a row drag from an interactive control (checkbox, text/number
  // inputs, buttons) — those need their own pointer/selection behavior.
  function onRowDragStart(e, id) {
    const t = e.target
    if (t.closest('input, textarea, select, button')) {
      e.preventDefault()
      return
    }
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onRowDragOver(e, id) {
    if (dragId == null || id === dragId) return
    e.preventDefault() // allow drop
    e.dataTransfer.dropEffect = 'move'
    if (id !== overId) setOverId(id)
  }
  function onRowDrop(e, id) {
    e.preventDefault()
    if (dragId != null && id !== dragId) reorderRow('holdings', dragId, id)
    setDragId(null)
    setOverId(null)
  }
  function onRowDragEnd() {
    setDragId(null)
    setOverId(null)
  }

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
        {holdings.map(h => {
          const checked = !!h.excluded
          const cls = ['row', 'two', 'holding-row']
          if (checked) cls.push('is-checked')
          if (dragId === h.id) cls.push('is-dragging')
          if (overId === h.id && dragId != null && dragId !== h.id) cls.push('is-drop-target')
          return (
            <div
              className={cls.join(' ')}
              key={h.id}
              draggable
              onDragStart={e => onRowDragStart(e, h.id)}
              onDragOver={e => onRowDragOver(e, h.id)}
              onDrop={e => onRowDrop(e, h.id)}
              onDragEnd={onRowDragEnd}
            >
              <span className="holding-label">
                <input
                  type="checkbox"
                  checked={checked}
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
                  <IconButton
                    label="Delete"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Delete "${h.label || 'this holding'}"?`)) deleteRow('holdings', h.id)
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="row total-row">
        <span>Total Available</span>
        <Computed value={total} strong />
      </div>
    </Section>
  )
}
