import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { usePageActions } from '../context/PageActionsContext.jsx'

// The single app-wide floating action button. A round toggle that fans out a
// small vertical stack of round, color-coded icon buttons (label text is carried
// on aria-label/title, not shown):
//   read-only:  [＋ Add (if the page registered one)]  [✎ Edit]
//   edit mode:  [＋ Add (if the page registered one)]  [✕ Cancel]  [✓ Save]
// "Add" invokes the page's registered primary action (e.g. the add-spend modal).
// "Edit" enters edit mode; "Save"/"Cancel" leave it (persistence is automatic/
// debounced, so both just mean "leave edit mode"). Closes on action select,
// scrim tap, Escape, or route change. Mirrors the Escape-listener pattern in
// Modal/NavDrawer.
export function FabMenu({ editable, onToggleEdit, onSave, onCancel }) {
  const { action, secondary } = usePageActions()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const firstActionRef = useRef(null)

  // Collapse the menu whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Escape closes the expanded menu.
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (open && firstActionRef.current) firstActionRef.current.focus()
  }, [open])

  // Run an action pill, then collapse the menu.
  function run(fn) {
    setOpen(false)
    fn()
  }

  return (
    <>
      {open && <div className="fab-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className={`fab-menu ${open ? 'is-open' : ''}`}>
        <div className="fab-menu-actions" role="menu" aria-hidden={!open}>
          {action && (
            <button
              type="button"
              ref={firstActionRef}
              className="fab-action fab-action-add"
              role="menuitem"
              aria-label={action.addLabel || 'Add'}
              title={action.addLabel || 'Add'}
              onClick={() => run(action.onAdd)}
            >
              ＋
            </button>
          )}
          {secondary && (
            <button
              type="button"
              className="fab-action fab-action-secondary"
              role="menuitem"
              aria-label={secondary.label}
              title={secondary.label}
              onClick={() => run(secondary.onRun)}
            >
              {secondary.glyph}
            </button>
          )}
          {editable ? (
            <>
              <button
                type="button"
                ref={action ? undefined : firstActionRef}
                className="fab-action fab-action-cancel"
                role="menuitem"
                aria-label="Cancel"
                title="Cancel"
                onClick={() => run(onCancel)}
              >
                ✕
              </button>
              <button
                type="button"
                className="fab-action fab-action-save"
                role="menuitem"
                aria-label="Save"
                title="Save"
                onClick={() => run(onSave)}
              >
                💾
              </button>
            </>
          ) : (
            <button
              type="button"
              ref={action ? undefined : firstActionRef}
              className="fab-action fab-action-edit"
              role="menuitem"
              aria-label="Edit"
              title="Edit"
              onClick={() => run(onToggleEdit)}
            >
              ✎
            </button>
          )}
        </div>
        <button
          type="button"
          className={`fab fab-toggle ${editable ? 'is-editing' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={open ? 'Close actions menu' : 'Open actions menu'}
          onClick={() => setOpen(o => !o)}
        >
          {open ? '✕' : '⋯'}
        </button>
      </div>
    </>
  )
}
