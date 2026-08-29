import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { creditCardTotal } from '../lib/calc.js'
import { uid, monthStartDate } from '../lib/storage.js'
import { parseNumber, formatINR } from '../lib/format.js'
import { Computed, Section, IconButton } from './ui.jsx'
import { MoneyInput, TextInput } from './Inputs.jsx'
import { SwipeToDelete } from './SwipeToDelete.jsx'
import { Modal } from './Modal.jsx'
import { useEditable } from '../context/EditModeContext.jsx'
import { useRegisterPageAction, useRegisterSecondaryAction } from '../context/PageActionsContext.jsx'

const emptyDraft = () => ({ cardId: '', categoryId: '', date: '', amount: '', notes: '' })

// Credit Card Spends screen: pick a card (or all), see this month's spends in a
// table (Date · Category · Amount · Notes), and add a spend via the app-wide
// floating action button's "＋ Add spend" action (registered below).
// Cards and categories are global master lists (settings); spends are per month.
export function CreditCardSpends({ month, settings, addRow, updateRow, deleteRow, syncRecurringNow }) {
  const navigate = useNavigate()
  const cards = settings.creditCards || []
  const categories = [...(settings.spendCategories || [])].sort((a, b) => a.name.localeCompare(b.name))

  const [selectedCard, setSelectedCard] = useState('') // '' = all cards
  const [filterOpen, setFilterOpen] = useState(false) // card-filter dropdown visibility
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [syncMsg, setSyncMsg] = useState('') // confirmation shown after a manual sync

  // Show spends sorted by date ascending (ISO YYYY-MM-DD strings sort lexically);
  // undated rows sort last so they don't jump to the top. Mirrors the EMIs/bills
  // "sort by day ascending" convention.
  const spends = (month.creditCards || [])
    .filter(s => !selectedCard || s.cardId === selectedCard)
    .slice()
    .sort((a, b) => {
      const da = a.date || ''
      const db = b.date || ''
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return da.localeCompare(db)
    })
  const total = creditCardTotal(month, selectedCard)

  const cardName = id => cards.find(c => c.id === id)?.name || '(deleted)'
  const categoryName = id => categories.find(c => c.id === id)?.name || '(deleted)'

  const openModal = useCallback(() => {
    setDraft({ ...emptyDraft(), cardId: selectedCard || cards[0]?.id || '', date: monthStartDate(month.id) })
    setModalOpen(true)
  }, [selectedCard, cards, month.id])
  // Register this page's primary add action so the app-wide FAB shows "＋ Add spend".
  useRegisterPageAction(openModal, '＋ Add spend', [openModal])
  // Register the insights view as the FAB's secondary action (📊 icon).
  const goInsights = useCallback(() => navigate('/credit-cards/insights'), [navigate])
  useRegisterSecondaryAction(goInsights, 'View insights', '📊', [goInsights])
  function closeModal() {
    setModalOpen(false)
  }
  // Adding/editing/deleting a spend already re-syncs future months automatically
  // (see addRow/updateRow/deleteRow in useBudgetStore); clear any stale sync
  // confirmation so it doesn't linger over a fresh edit.
  function saveSpend() {
    if (!draft.cardId) return
    setSyncMsg('')
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

  // Manual re-sync for parity with "Manage Bills & EMIs": re-apply the templates
  // to every future month so their card payables pick up the latest spends. Spend
  // edits already trigger this automatically; the button is an on-demand refresh
  // (e.g. for months created before auto-sync, or just to reassure the user).
  function handleSync() {
    const n = syncRecurringNow ? syncRecurringNow() : 0
    setSyncMsg(n ? `✓ Synced ${n} future month${n === 1 ? '' : 's'}` : 'No future months to sync')
  }

  const canSave = !!draft.cardId

  return (
    <div className="spends-page">
      {syncMsg && <p className="sync-msg" role="status">{syncMsg}</p>}

      <Section
        title="Credit Card Spends"
        accent="#7c5cff"
        actions={
          <div className="spends-head-actions">
            <button
              className="mb-btn"
              onClick={handleSync}
              title="Re-apply recurring templates to all future months so their card payables pick up the latest spends"
            >
              ⟳ Sync
            </button>
            {cards.length > 0 && (
              <CardFilter
                cards={cards}
                selectedCard={selectedCard}
                cardName={cardName}
                onSelect={setSelectedCard}
                open={filterOpen}
                setOpen={setFilterOpen}
              />
            )}
          </div>
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
              {spends.map(s => {
                const removeRow = () => {
                  if (window.confirm(`Delete this spend${s.notes ? ` "${s.notes}"` : ''} of ${formatINR(s.amount)}?`)) {
                    deleteRow('creditCards', s.id)
                  }
                }
                return (
                <SwipeToDelete key={s.id} onDelete={removeRow}>
                <div className="trow">
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
                    <IconButton label="Delete spend" variant="danger" onClick={removeRow} />
                  </span>
                </div>
                </SwipeToDelete>
                )
              })}
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

// Card filter: a compact funnel icon button that opens a small popover menu of
// options (All cards + one per card). No visible <select> — tapping the funnel
// reveals just the option list; picking one selects it and closes the popover.
// Closes on outside click, Escape, or route/selection change (mirrors the
// Escape-listener idiom in Modal/FabMenu).
// Menu geometry — MENU_WIDTH must stay in sync with .card-filter-menu min-width.
const MENU_WIDTH = 180
const VIEWPORT_PAD = 8 // min gap kept from the viewport's left/right edges
const MENU_GAP = 6 // gap between the funnel button and the menu (was top:calc(100%+6px))

function CardFilter({ cards, selectedCard, cardName, onSelect, open, setOpen }) {
  const wrapRef = useRef(null) // the funnel-button cluster (the trigger)
  const btnRef = useRef(null) // the funnel button itself (positioning anchor)
  const menuRef = useRef(null) // the portalled menu (outside-click guard + measuring)
  const [pos, setPos] = useState(null) // { top, left } in viewport space, or null before first measure

  // Compute fixed coords from the button rect: right-aligned to the funnel, then
  // clamped so the menu never runs off either viewport edge (critical at 360px).
  const place = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    // Prefer the measured menu width (long card names widen it); fall back to the
    // CSS min-width until the menu has mounted.
    const menuW = menuRef.current?.offsetWidth || MENU_WIDTH
    let left = r.right - menuW // right edge of menu aligns to right edge of button
    const maxLeft = window.innerWidth - menuW - VIEWPORT_PAD
    left = Math.max(VIEWPORT_PAD, Math.min(left, maxLeft))
    setPos({ top: r.bottom + MENU_GAP, left })
  }, [])

  // Position synchronously before paint when opening, so there's no flash at (0,0).
  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  // Fixed positioning is viewport-relative, so it must react to scroll/resize.
  // Decision: CLOSE on scroll, REPOSITION on resize. Justified below.
  useEffect(() => {
    if (!open) return
    const onScroll = () => setOpen(false)
    const onResize = () => place()
    // Capture phase so scrolls on ANY ancestor scroll container are caught.
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, setOpen, place])

  // Close on outside click (pointerdown) and on Escape. The menu is portalled to
  // <body>, so it is NOT inside wrapRef — guard it with its own menuRef.
  useEffect(() => {
    if (!open) return
    function onDocDown(e) {
      if (wrapRef.current && wrapRef.current.contains(e.target)) return // trigger: button onClick toggles
      if (menuRef.current && menuRef.current.contains(e.target)) return // inside menu: not "outside"
      setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])

  const options = [{ id: '', name: 'All cards' }, ...cards]

  return (
    <div className="spends-actions" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className={`filter-btn ${selectedCard ? 'is-active' : ''}`}
        aria-label="Filter by card"
        aria-haspopup="menu"
        aria-expanded={open}
        title={selectedCard ? cardName(selectedCard) : 'Filter by card'}
        onClick={() => setOpen(o => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            className="card-filter-menu"
            role="menu"
            aria-label="Filter by card"
            ref={menuRef}
            style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          >
            {options.map(o => (
              <button
                key={o.id || 'all'}
                type="button"
                role="menuitemradio"
                aria-checked={selectedCard === o.id}
                className={`card-filter-option ${selectedCard === o.id ? 'is-selected' : ''}`}
                onClick={() => {
                  onSelect(o.id)
                  setOpen(false)
                  btnRef.current?.focus()
                }}
              >
                {o.name}
              </button>
            ))}
          </div>,
          document.body
        )}
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
