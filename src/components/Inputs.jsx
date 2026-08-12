import { useEffect, useRef, useState } from 'react'
import { formatINR, isNegative, parseNumber } from '../lib/format.js'
import { useEditable } from '../context/EditModeContext.jsx'

// A number cell that shows formatted INR when idle and a raw editable value when
// focused. Commits on blur / Enter. inputMode="decimal" gives phones a number pad.
// When the page is read-only it renders as static, non-clickable text.
// When `placeholder` is set and the value is falsy (0/unset), the placeholder
// text is shown muted instead of "₹ 0" — used for card bills whose amount hasn't
// been entered yet. The editing input is unaffected so typing real values works.
export function MoneyInput({ value, onChange, symbol = true, className = '', placeholder = '' }) {
  const editable = useEditable()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (editing && ref.current) ref.current.select()
  }, [editing])

  function commit() {
    onChange(parseNumber(draft))
    setEditing(false)
  }

  const showPlaceholder = placeholder && !value // 0, NaN, undefined, ''

  if (!editable) {
    return (
      <span
        className={`cell-display ro money ${isNegative(value) ? 'neg' : ''} ${showPlaceholder ? 'is-placeholder' : ''} ${className}`}
      >
        {showPlaceholder ? placeholder : formatINR(value, { withSymbol: symbol })}
      </span>
    )
  }

  if (editing) {
    return (
      <input
        ref={ref}
        className={`cell-input money ${className}`}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  return (
    <button
      type="button"
      className={`cell-display money ${isNegative(value) ? 'neg' : ''} ${showPlaceholder ? 'is-placeholder' : ''} ${className}`}
      onClick={() => {
        setDraft(value === 0 ? '' : String(value))
        setEditing(true)
      }}
    >
      {showPlaceholder ? placeholder : formatINR(value, { withSymbol: symbol })}
    </button>
  )
}

// A plain text cell (labels, names, dates rendered as text). Read-only when the
// page is locked — shows the value as static text (dates formatted for display).
export function TextInput({ value, onChange, placeholder = '', type = 'text', className = '' }) {
  const editable = useEditable()
  if (!editable) {
    const display = type === 'date' ? formatDateDisplay(value) : (value ?? '')
    return <span className={`cell-display ro text ${className}`}>{display || '—'}</span>
  }
  return (
    <input
      className={`cell-input ${className}`}
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  )
}

// "2026-08-01" -> "01 Aug 2026" for read-only display; passthrough otherwise.
function formatDateDisplay(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-')
  if (!y || !m || !d) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[Number(m) - 1] || m} ${y}`
}
