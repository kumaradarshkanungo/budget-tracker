import { useEditable } from '../context/EditModeContext.jsx'

// Floating "Save" button shown only in edit mode. Persistence is automatic and
// debounced, so "Save" simply means "leave edit mode" — the same action the
// header's Done button performs (onExit). It lets you exit from anywhere on the
// page without scrolling back to the top.
// stacked: true on screens that already show the round "add" FAB (credit-card
// spends), so this pill sits above it instead of overlapping.
export function SaveFab({ onExit, stacked = false }) {
  const editable = useEditable()
  if (!editable) return null
  return (
    <button
      type="button"
      className={`fab fab-save${stacked ? ' fab-stacked' : ''}`}
      onClick={onExit}
      aria-label="Save and exit edit mode"
    >
      ✓ Save
    </button>
  )
}
