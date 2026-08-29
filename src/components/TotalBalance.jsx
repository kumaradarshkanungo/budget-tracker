import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
// edit mode). The checkbox is always interactive.
//
// DISPLAY ORDER (this table only): checked holdings are struck through and sink
// to the bottom, unchecked ones stay on top — a STABLE partition, so within each
// group the stored array order is kept. Because we only re-sort for DISPLAY (the
// stored `month.holdings` order is untouched by checking), unchecking a holding
// returns it to its original slot for free. Reordering rewrites that stored order
// via reorderRow, so a manual arrangement persists.
//
// REORDER via @dnd-kit (reliable on mouse + touch, no visible drag handle by
// request — the whole row is the drag surface). Mouse arms after a 6px move;
// touch arms after a ~600ms hold (so a quick vertical swipe still scrolls the
// page). A picked-up row dims and lifts (see .is-dragging in styles.css) so it's
// clear what's being moved. Interactive controls (checkbox / inputs / delete)
// stop pointerdown from reaching the sensor, so they keep working normally.

function SortableHolding({ h, updateRow, deleteRow }) {
  const checked = !!h.excluded
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: h.id,
  })
  const style = {
    // Combine dnd-kit's positional transform with a slight scale-up so the
    // picked-up row visibly lifts. Inline transform wins over any CSS transform,
    // so the scale must live here, not in .is-dragging CSS.
    transform: [CSS.Transform.toString(transform), isDragging ? 'scale(1.02)' : '']
      .filter(Boolean)
      .join(' '),
    transition,
    // Lift the picked-up row above its siblings; the rest of the "grabbed" look
    // (transparency, shadow) lives in the .is-dragging CSS class.
    zIndex: isDragging ? 3 : undefined,
  }
  const cls = ['row', 'two', 'holding-row']
  if (checked) cls.push('is-checked')
  if (isDragging) cls.push('is-dragging')

  // Prevent a pointerdown on interactive controls from starting a drag.
  const stop = e => e.stopPropagation()

  return (
    <div
      ref={setNodeRef}
      className={cls.join(' ')}
      style={style}
      {...attributes}
      {...listeners}
    >
      <span className="holding-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => updateRow('holdings', h.id, { excluded: e.target.checked })}
          onPointerDown={stop}
          aria-label="Exclude from Total Available (received / already in a bank)"
        />
        {h.riId ? (
          <span className="cell-display ro text">{h.label || '—'}</span>
        ) : (
          <span onPointerDown={stop}>
            <TextInput
              value={h.label}
              placeholder="Label"
              onChange={v => updateRow('holdings', h.id, { label: v })}
            />
          </span>
        )}
      </span>
      <div className="row-end">
        {h.riId ? (
          <Computed value={h.amount} />
        ) : (
          <span onPointerDown={stop}>
            <MoneyInput value={h.amount} onChange={v => updateRow('holdings', h.id, { amount: v })} />
          </span>
        )}
        {!h.riId && (
          <span onPointerDown={stop}>
            <IconButton
              label="Delete"
              variant="danger"
              onClick={() => {
                if (window.confirm(`Delete "${h.label || 'this holding'}"?`)) deleteRow('holdings', h.id)
              }}
            />
          </span>
        )}
      </div>
    </div>
  )
}

export function TotalBalance({ month, addRow, updateRow, deleteRow, reorderRow }) {
  const total = totalAvailable(month)
  const bankBalance = totalBankBalance(month)

  const sensors = useSensors(
    // Mouse/pen: start dragging after a small move so plain clicks still work.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch: hold for ~600ms to arm the drag, so a quick vertical swipe just
    // scrolls the page. Tolerance keeps the hold alive through tiny finger jitter.
    useSensor(TouchSensor, { activationConstraint: { delay: 600, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Stable display order: keep the stored array order, then float checked rows to
  // the bottom. Array.prototype.sort is stable in modern engines, so equal keys
  // (same `excluded`) preserve their relative (stored) order.
  const holdings = (month.holdings || [])
    .map((h, i) => ({ h, i }))
    .sort((a, b) => Number(!!a.h.excluded) - Number(!!b.h.excluded) || a.i - b.i)
    .map(x => x.h)
  const ids = holdings.map(h => h.id)

  function onDragEnd(event) {
    const { active, over } = event
    if (over && active.id !== over.id) reorderRow('holdings', active.id, over.id)
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {holdings.map(h => (
              <SortableHolding key={h.id} h={h} updateRow={updateRow} deleteRow={deleteRow} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <div className="row total-row">
        <span>Total Available</span>
        <Computed value={total} strong />
      </div>
    </Section>
  )
}
