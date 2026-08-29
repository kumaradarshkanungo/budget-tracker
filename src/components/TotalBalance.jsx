import { useRef, useState } from 'react'
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
// returns it to its original slot for free. Reordering rewrites that stored order
// via reorderRow, so a manual arrangement persists.
//
// REORDER via POINTER EVENTS (works the same on mouse + touch; native HTML5 DnD
// doesn't fire on touch and gives inconsistent cursors). A press that lingers or
// moves a little starts a drag: on desktop the row grabs immediately; on touch a
// short LONG-PRESS arms it (so a quick swipe still scrolls the page). Dragging is
// never started from the checkbox / inputs / buttons, so those keep working.
const LONGPRESS_MS = 220 // touch: hold this long (without scrolling) to arm a drag
const MOVE_ARM_PX = 6 // mouse: pointer must travel this far before a drag begins

export function TotalBalance({ month, addRow, updateRow, deleteRow, reorderRow }) {
  const total = totalAvailable(month)
  const bankBalance = totalBankBalance(month)
  const [dragId, setDragId] = useState(null) // holding id actively dragging, or null
  const [overId, setOverId] = useState(null) // holding id currently hovered as drop target
  const drag = useRef(null) // live gesture: { id, pointerId, armed, startY, timer }

  // Stable display order: keep the stored array order, then float checked rows to
  // the bottom. Array.prototype.sort is stable in modern engines, so equal keys
  // (same `excluded`) preserve their relative (stored) order.
  const holdings = (month.holdings || [])
    .map((h, i) => ({ h, i }))
    .sort((a, b) => Number(!!a.h.excluded) - Number(!!b.h.excluded) || a.i - b.i)
    .map(x => x.h)

  // The holding whose row is under the given viewport Y (excludes the dragged row).
  function rowIdAtY(y, container) {
    const rows = container.querySelectorAll('[data-holding-id]')
    for (const el of rows) {
      const r = el.getBoundingClientRect()
      if (y >= r.top && y <= r.bottom) return el.getAttribute('data-holding-id')
    }
    return null
  }

  function cancelGesture() {
    const g = drag.current
    if (g?.timer) clearTimeout(g.timer)
    drag.current = null
    setDragId(null)
    setOverId(null)
  }

  function onPointerDown(e, id) {
    // Never hijack the checkbox, editable fields, or the delete button.
    if (e.target.closest('input, textarea, select, button')) return
    if (e.button != null && e.button !== 0) return // ignore right/middle click
    const isTouch = e.pointerType === 'touch'
    const g = { id, pointerId: e.pointerId, armed: false, startY: e.clientY, timer: null }
    drag.current = g
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (isTouch) {
      // Touch: arm only after a short hold, so a quick vertical swipe still scrolls.
      g.timer = setTimeout(() => {
        if (drag.current === g) {
          g.armed = true
          setDragId(id)
        }
      }, LONGPRESS_MS)
    }
  }

  function onPointerMove(e) {
    const g = drag.current
    if (!g) return
    if (!g.armed) {
      // Mouse: begin dragging once the pointer has moved past the threshold.
      if (e.pointerType !== 'touch' && Math.abs(e.clientY - g.startY) >= MOVE_ARM_PX) {
        g.armed = true
        setDragId(g.id)
      } else {
        // Touch not yet armed: if the finger moves before the long-press fires,
        // treat it as a scroll — abandon the pending drag.
        if (e.pointerType === 'touch' && Math.abs(e.clientY - g.startY) >= MOVE_ARM_PX) cancelGesture()
        return
      }
    }
    e.preventDefault() // armed: suppress scroll/selection while reordering
    const container = e.currentTarget.closest('.rows')
    if (!container) return
    const targetId = rowIdAtY(e.clientY, container)
    setOverId(targetId && targetId !== g.id ? targetId : null)
  }

  function onPointerUp() {
    const g = drag.current
    if (g?.armed && overId && overId !== g.id) reorderRow('holdings', g.id, overId)
    cancelGesture()
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
              data-holding-id={h.id}
              onPointerDown={e => onPointerDown(e, h.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={cancelGesture}
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
