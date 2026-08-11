import { useState } from 'react'
import { labelForMonthId } from '../lib/storage.js'

// Month controls + backup: switch/add/delete months via a month-only picker,
// show sync status, and JSON export/import. (Settings + Sign out now live in the
// app header.)
export function MonthBar({
  month,
  months,
  switchMonth,
  addMonth,
  deleteMonth,
  exportJSON,
  importJSON,
  syncState,
  syncError,
  auth,
  editable,
  onToggleEdit,
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
  function handleExport() {
    const blob = new Blob([exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budget-backup-${month.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importJSON(String(reader.result))
        window.alert('Backup imported.')
      } catch (err) {
        window.alert('Import failed: ' + err.message)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
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
        <button
          className={`mb-btn ${editable ? 'primary' : ''}`}
          onClick={onToggleEdit}
          aria-pressed={editable}
        >
          {editable ? '✓ Done' : '✎ Edit'}
        </button>
        <button className="mb-btn" onClick={handleExport}>Export</button>
        <label className="mb-btn file-btn">
          Import
          <input type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />
        </label>
      </div>
    </div>
  )
}
