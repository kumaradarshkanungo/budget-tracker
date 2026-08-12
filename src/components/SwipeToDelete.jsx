import { useEffect, useRef, useState } from 'react'

// Width (px) of the revealed Delete panel. MUST stay in sync with the
// .swipe-delete-panel width in styles.css.
const REVEAL = 76
// Deadzone before we decide the gesture is a horizontal swipe vs a vertical
// scroll — below this we don't commit to either axis.
const DEADZONE = 8

// Module-level registry of currently-open rows so only ONE row is open at a
// time and an outside tap closes it. Each open row registers its close fn.
const openRows = new Set()
function closeOthers(except) {
  openRows.forEach(close => {
    if (close !== except) close()
  })
}

// A single shared document listener: a touch anywhere closes every open row.
// The row's own onTouchStart re-opens/keeps itself as needed (it runs first and
// registers before this fires only for taps outside any row). Attached once.
let docListenerCount = 0
function useOutsideTapCloser() {
  useEffect(() => {
    if (docListenerCount === 0) {
      document.addEventListener('touchstart', onDocTouch, { passive: true })
    }
    docListenerCount += 1
    return () => {
      docListenerCount -= 1
      if (docListenerCount === 0) document.removeEventListener('touchstart', onDocTouch)
    }
  }, [])
}
function onDocTouch(e) {
  // If the touch landed inside a row that is currently open, leave it; the
  // row's own handlers manage it. Otherwise close everything.
  const inSwipeRow = e.target.closest && e.target.closest('.swipe-row')
  if (!inSwipeRow) closeOthers(null)
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Mobile-only swipe-left-to-reveal-delete wrapper. Renders `children` (a row) in
// a sliding foreground layer over a red Delete button pinned to the right edge.
// Touch-only and additive: desktop/keyboard users still use the edit-mode trash
// button. `onDelete` is the caller's existing confirm+delete handler, reused
// verbatim. `disabled` renders children unwrapped (for non-deletable rows), so
// the component adds zero DOM/CSS in that case.
export function SwipeToDelete({ onDelete, disabled = false, label = 'Delete', className = '', children }) {
  const [tx, setTx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const g = useRef({ startX: 0, startY: 0, startTx: 0, axis: null })
  useOutsideTapCloser()

  // Keep the module registry in sync with this row's open/closed state.
  useEffect(() => {
    const close = () => setTx(0)
    if (tx !== 0) {
      openRows.add(close)
      return () => openRows.delete(close)
    }
    return undefined
  }, [tx])

  if (disabled) return children

  function onTouchStart(e) {
    const t = e.touches[0]
    g.current = { startX: t.clientX, startY: t.clientY, startTx: tx, axis: null }
    setDragging(true)
    // Starting a new swipe closes any other open row.
    closeOthers(() => setTx(0))
  }

  function onTouchMove(e) {
    const t = e.touches[0]
    const dx = t.clientX - g.current.startX
    const dy = t.clientY - g.current.startY
    if (g.current.axis === null) {
      if (Math.abs(dx) < DEADZONE && Math.abs(dy) < DEADZONE) return
      g.current.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (g.current.axis === 'v') return // let the page scroll
    // Horizontal swipe: take over and slide the foreground. Clamp so it only
    // opens leftward (to -REVEAL) and never past closed.
    e.preventDefault()
    setTx(clamp(g.current.startTx + dx, -REVEAL, 0))
  }

  function onTouchEnd() {
    setDragging(false)
    setTx(prev => (prev <= -REVEAL * 0.5 ? -REVEAL : 0))
  }

  function handleDeleteTap() {
    setTx(0)
    onDelete()
  }

  return (
    <div
      className={`swipe-row ${dragging ? 'dragging' : ''} ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <button type="button" className="swipe-delete-panel" aria-label={label} onClick={handleDeleteTap}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
        {label}
      </button>
      <div className="swipe-fg" style={{ transform: `translateX(${tx}px)` }}>
        {children}
      </div>
    </div>
  )
}
