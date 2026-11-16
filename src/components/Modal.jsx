import { useEffect } from 'react'

// Minimal centered modal dialog. It intentionally stays open when the backdrop
// is clicked so an accidental click cannot discard in-progress form data.
// Escape and the explicit close/cancel controls still close it.
export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
