import { useEffect, useRef, useState } from 'react'

// Width (px) of the revealed Delete panel. MUST stay in sync with the
// .swipe-delete-panel width in styles.css.
const REVEAL = 76
// Movement (px) below which a gesture is still "undecided" — used both for the
// horizontal/vertical axis lock and for classifying a touch as a tap vs a drag.
const SLOP = 8
// Snap open once dragged past half the panel width.
const SNAP = REVEAL * 0.5

// Module-level registry of currently-open rows so only ONE row is open at a
// time and an outside tap closes it. Each open row registers its close fn.
const openRows = new Set()
function closeOthers(except) {
  openRows.forEach(close => {
    if (close !== except) close()
  })
}

// A single shared document listener: a touch that lands outside every swipe row
// closes any open row. Attached once, ref-counted across mounted rows.
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
  // A touch inside any swipe row is handled by that row itself; only an outside
  // tap closes everything.
  const inSwipeRow = e.target.closest && e.target.closest('.swipe-row')
  if (!inSwipeRow) closeOthers(null)
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Mobile-only swipe-left-to-reveal-delete wrapper. Renders `children` (a row) in
// a sliding foreground layer (.swipe-fg) over a red Delete button pinned to the
// right edge. Touch-only and additive: desktop/keyboard users use the edit-mode
// trash button. `onDelete` is the caller's existing confirm+delete handler,
// reused verbatim. `disabled` renders children unwrapped (for non-deletable
// rows), so the component adds zero DOM/CSS in that case.
//
// Design (hardened after an adversarial review of the naive version):
//  - Touch handlers live on the FOREGROUND, not the wrapper, so the Delete panel
//    is never inside the drag surface — a tap on it can't be mistaken for a drag.
//  - During a drag we write `transform` to the DOM node imperatively (no React
//    re-render per frame) for smoothness; `commitTx` reconciles state + DOM at
//    every gesture terminus so they can't desync (no stuck-open rows).
//  - The panel only becomes tappable (pointer-events) once the row is open, and
//    delete is fired from the panel's own click while the row stays put — the
//    caller's window.confirm then runs. We DON'T pre-close on tap (that was the
//    "slides back before it deletes" bug).
export function SwipeToDelete({ onDelete, disabled = false, label = 'Delete', className = '', children }) {
  const [tx, setTx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const fgRef = useRef(null)
  const txRef = useRef(0)          // authoritative current position (mirrors state)
  const closeRef = useRef(null)    // this row's registered close fn (for closeOthers exclusion)
  const mounted = useRef(true)
  const g = useRef(null)           // gesture-local scratch, reset on each touchstart
  useOutsideTapCloser()

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Reconciliation primitive: clear any imperative inline transform, then set
  // state. If the target equals the current state value React won't re-run the
  // style commit, so re-assert it imperatively for that no-op-render case.
  function commitTx(value) {
    if (fgRef.current) fgRef.current.style.transform = ''
    if (value !== txRef.current) {
      txRef.current = value
      setTx(value)
    } else if (fgRef.current) {
      fgRef.current.style.transform = `translateX(${value}px)`
    }
  }

  // Keep the module registry in sync with this row's open/closed state.
  useEffect(() => {
    txRef.current = tx
    const close = () => commitTx(0)
    closeRef.current = close
    if (tx !== 0) {
      openRows.add(close)
      return () => openRows.delete(close)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx])

  if (disabled) return children

  function onTouchStart(e) {
    const t = e.touches[0]
    g.current = { startX: t.clientX, startY: t.clientY, baseTx: txRef.current, axis: null, moved: false }
  }

  function onTouchMove(e) {
    if (!g.current) return
    const t = e.touches[0]
    const dx = t.clientX - g.current.startX
    const dy = t.clientY - g.current.startY
    if (g.current.axis === null) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      g.current.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (g.current.axis === 'h') {
        g.current.moved = true
        setDragging(true)
        // Close every OTHER open row — exclude this row's own registered close fn
        // so re-swiping an already-open row doesn't reset its position mid-drag.
        closeOthers(closeRef.current)
      }
    }
    if (g.current.axis !== 'h') return // vertical → let the page scroll
    e.preventDefault()
    const next = clamp(g.current.baseTx + dx, -REVEAL, 0)
    g.current.last = next
    if (fgRef.current) fgRef.current.style.transform = `translateX(${next}px)`
  }

  function onTouchEnd() {
    const started = g.current
    g.current = null
    setDragging(false)
    if (!started || !started.moved) return // a tap (not a drag) → leave as-is
    const final = started.last <= -SNAP ? -REVEAL : 0
    commitTx(final)
  }

  function handleDeleteTap() {
    // Run the caller's confirm+delete. Only reset our position if the row
    // survived (confirm cancelled / async). If it was deleted the row unmounts.
    onDelete()
    if (mounted.current) commitTx(0)
  }

  const open = tx <= -REVEAL + 1

  return (
    <div className={`swipe-row ${open ? 'is-open' : ''} ${dragging ? 'is-dragging' : ''} ${className}`}>
      <button
        type="button"
        className="swipe-delete-panel"
        aria-label={label}
        onClick={handleDeleteTap}
        tabIndex={open ? 0 : -1}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
        {label}
      </button>
      <div
        className={`swipe-fg ${dragging ? 'dragging' : ''}`}
        ref={fgRef}
        style={{ transform: `translateX(${tx}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
