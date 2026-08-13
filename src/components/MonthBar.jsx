import { useState } from 'react'
import { labelForMonthId, currentMonthId } from '../lib/storage.js'

// Month controls: switch/add/delete months via a month-only picker and show
// sync status. (Edit mode is toggled from the app-wide floating action button;
// Backup / Export / Import now live in Settings; Settings + Sign out live in the
// app header.)
export function MonthBar({
  month,
  months,
  switchMonth,
  addMonth,
  deleteMonth,
  syncState,
  syncError,
  auth,
  editable,
}) {
  const [picking, setPicking] = useState(false)
  const [pick, setPick] = useState('')

  // The active `month` from the store carries no label (only the entries in the
  // `months` array do). Derive it from the id so the delete prompt reads right.
  const monthLabel = month.label || labelForMonthId(month.id)

  // "Jump to current month" button state. switchMonth does no validation, so we
  // only enable the jump when the current calendar month actually exists in the
  // list (switching to a missing month id would make the active month undefined
  // and crash the page) and isn't already the one being viewed.
  const nowId = currentMonthId()
  const nowExists = months.some(m => m.id === nowId)
  const atCurrent = month.id === nowId
  const canJumpToCurrent = nowExists && !atCurrent

  function confirmAdd() {
    if (pick) addMonth(pick) // pick is "YYYY-MM" from <input type="month">
    setPicking(false)
    setPick('')
  }
  function handleDelete() {
    if (months.length <= 1) {
      window.alert('Cannot delete the only month.')
      return
    }
    if (window.confirm(`Delete "${monthLabel}"? This cannot be undone.`)) deleteMonth(month.id)
  }

  const syncLabel = {
    idle: '',
    loading: 'Loading…',
    saving: 'Saving…',
    saved: 'Synced ✓',
    error: 'Sync error',
    offline: 'Offline',
  }[syncState || 'idle']

  return (
    <div className="month-bar">
      <div className="month-bar-left">
        <select className="month-select" value={month.id} onChange={e => switchMonth(e.target.value)}>
          {months.map(m => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="icon-btn"
          onClick={() => switchMonth(nowId)}
          disabled={!canJumpToCurrent}
          aria-label="Jump to current month"
          title={atCurrent ? 'Already on the current month' : (nowExists ? 'Jump to current month' : 'Current month not added yet')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </button>

        {editable && (picking ? (
          <span className="month-pick">
            <input
              type="month"
              className="cell-input"
              value={pick}
              onChange={e => setPick(e.target.value)}
              autoFocus
            />
            <button className="mb-btn" onClick={confirmAdd} disabled={!pick}>Add</button>
            <button className="mb-btn" onClick={() => setPicking(false)}>Cancel</button>
          </span>
        ) : (
          <button className="mb-btn" onClick={() => setPicking(true)}>＋ Month</button>
        ))}

        {editable && (
          <button className="mb-btn danger" onClick={handleDelete}>Delete</button>
        )}
      </div>

      <div className="month-bar-right">
        {auth?.configured && (
          <span
            className="sync-badge"
            data-state={syncState}
            title={syncState === 'error' ? syncError || 'Sync failed' : undefined}
          >
            {syncLabel}
            {syncState === 'error' && syncError ? ` — ${syncError}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}
