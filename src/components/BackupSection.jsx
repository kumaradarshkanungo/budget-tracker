import { useState } from 'react'
import { Section } from './ui.jsx'
import { Modal } from './Modal.jsx'
import { PER_MONTH_KEYS } from '../lib/storage.js'
import { useEditable } from '../context/EditModeContext.jsx'

// Human labels for the per-month data groups a selective export can include.
const GROUP_LABELS = {
  holdings: 'Holdings',
  banks: 'Banks',
  budget: 'Budget',
  bills: 'Bills & EMIs',
  creditCards: 'Card spends',
}

// Backup & Restore: export a chosen set of months + data groups to a JSON file,
// and import (merge) a backup file. Lives in Settings (moved out of the header).
// Export is always available (read-only); Import is gated behind edit mode since
// it mutates the store — same convention as the other Settings mutations.
export function BackupSection({ months, exportSelectionJSON, importJSON }) {
  const editable = useEditable()
  const monthList = months || []
  const [open, setOpen] = useState(false)
  // Selection draft — defaults to everything checked.
  const [monthIds, setMonthIds] = useState(() => monthList.map(m => m.id))
  const [keys, setKeys] = useState(() => [...PER_MONTH_KEYS])
  const [includeGlobal, setIncludeGlobal] = useState(true)

  function openModal() {
    // Reset the draft to "everything" each time so it reflects the current months.
    setMonthIds(monthList.map(m => m.id))
    setKeys([...PER_MONTH_KEYS])
    setIncludeGlobal(true)
    setOpen(true)
  }

  const allMonths = monthIds.length === monthList.length && monthList.length > 0
  function toggleAllMonths() {
    setMonthIds(allMonths ? [] : monthList.map(m => m.id))
  }
  function toggleMonth(id) {
    setMonthIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }
  function toggleKey(k) {
    setKeys(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]))
  }

  // Download is valid only when at least one month AND at least one data group
  // (a per-month group or global settings) is selected.
  const canDownload = monthIds.length > 0 && (keys.length > 0 || includeGlobal)

  function download() {
    const json = exportSelectionJSON({ monthIds, perMonthKeys: keys, includeGlobal })
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Name by the single selected month, else "all".
    const stamp = monthIds.length === 1 ? monthIds[0] : 'all'
    a.download = `budget-backup-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
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

  return (
    <Section title="Backup & Restore">
      <p className="hint section-intro">
        Export your data to a JSON file, choosing which months and which data to include.
        Import merges a backup file into your current data.
      </p>
      <div className="backup-actions">
        <button className="mb-btn" onClick={openModal}>⬇ Export…</button>
        {editable && (
          <label className="mb-btn file-btn">
            ⬆ Import
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </label>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Export data"
        footer={
          <>
            <button type="button" className="mb-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="mb-btn primary" onClick={download} disabled={!canDownload}>
              Download
            </button>
          </>
        }
      >
        <div className="export-group">
          <div className="export-group-head">
            <span className="export-group-title">Months</span>
            <button type="button" className="link-btn" onClick={toggleAllMonths}>
              {allMonths ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="export-checks">
            {monthList.map(m => (
              <label key={m.id} className="export-check">
                <input
                  type="checkbox"
                  checked={monthIds.includes(m.id)}
                  onChange={() => toggleMonth(m.id)}
                />
                <span>{m.label}</span>
              </label>
            ))}
            {monthList.length === 0 && <p className="hint">No months to export.</p>}
          </div>
        </div>

        <div className="export-group">
          <div className="export-group-head">
            <span className="export-group-title">Data to include</span>
          </div>
          <div className="export-checks">
            {PER_MONTH_KEYS.map(k => (
              <label key={k} className="export-check">
                <input type="checkbox" checked={keys.includes(k)} onChange={() => toggleKey(k)} />
                <span>{GROUP_LABELS[k]}</span>
              </label>
            ))}
            <label className="export-check">
              <input
                type="checkbox"
                checked={includeGlobal}
                onChange={() => setIncludeGlobal(g => !g)}
              />
              <span>Global settings (cards, categories, recurring)</span>
            </label>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            Global settings are shared across all months. Include them for a fully restorable backup.
          </p>
        </div>
      </Modal>
    </Section>
  )
}
