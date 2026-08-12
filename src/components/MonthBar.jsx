import { useState } from 'react'
import { labelForMonthId } from '../lib/storage.js'

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
