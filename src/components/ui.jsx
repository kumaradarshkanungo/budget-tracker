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

// Small icon button used for delete / add. Hidden when the page is read-only,
// so add/delete affordances only appear in edit mode. The danger variant shows a
// trash-can icon (inline SVG, stroke=currentColor so .danger's red applies); the
// add variant shows a plus glyph. The button keeps its aria-label/title, and the
// SVG is aria-hidden since it's decorative.
export function IconButton({ label, onClick, variant = '' }) {
  const editable = useEditable()
  if (!editable) return null
  return (
    <button type="button" className={`icon-btn ${variant}`} onClick={onClick} aria-label={label} title={label}>
      {variant === 'danger' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      ) : (
        '＋'
      )}
    </button>
  )
}
