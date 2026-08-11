import { formatINR, isNegative } from '../lib/format.js'
import { useEditable } from '../context/EditModeContext.jsx'

// Read-only computed money value, styled red-in-parentheses when negative.
export function Computed({ value, symbol = true, strong = false }) {
  return (
    <span className={`computed ${isNegative(value) ? 'neg' : ''} ${strong ? 'strong' : ''}`}>
      {formatINR(value, { withSymbol: symbol })}
    </span>
  )
}

// Section wrapper with a titled header (colour accent optional).
export function Section({ title, accent, children, actions }) {
  return (
    <section className="section">
      <header className="section-head" style={accent ? { '--accent': accent } : undefined}>
        <h2>{title}</h2>
        {actions}
      </header>
      <div className="section-body">{children}</div>
    </section>
  )
}

// Small icon-ish button used for delete / add. Hidden when the page is
// read-only, so add/delete affordances only appear in edit mode.
export function IconButton({ label, onClick, variant = '' }) {
  const editable = useEditable()
  if (!editable) return null
  return (
    <button type="button" className={`icon-btn ${variant}`} onClick={onClick} aria-label={label} title={label}>
      {variant === 'danger' ? '✕' : '＋'}
    </button>
  )
}
