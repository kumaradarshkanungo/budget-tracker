import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useStoreCtx } from './context/StoreContext.jsx'
import { EditModeProvider } from './context/EditModeContext.jsx'
import { PageActionsProvider } from './context/PageActionsContext.jsx'
import { MonthBar } from './components/MonthBar.jsx'
import { AppHeader } from './components/AppHeader.jsx'
import { NavDrawer } from './components/NavDrawer.jsx'
import { FabMenu } from './components/FabMenu.jsx'
import { Login } from './components/Login.jsx'

// Mobile-only "hide on scroll down, reveal on scroll up" for the sticky header.
// Returns a boolean the header uses to slide itself out of view. Desktop
// (>640px) never hides — the header stays pinned as before.
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const THRESHOLD = 56 // ~header height: don't hide until scrolled past it

    function update() {
      ticking.current = false
      if (!mq.matches) {
        setHidden(false)
        return
      }
      const y = window.scrollY
      const goingDown = y > lastY.current
      // Hide when scrolling down past the header; reveal on any upward scroll or
      // near the very top.
      if (goingDown && y > THRESHOLD) setHidden(true)
      else if (!goingDown) setHidden(false)
      lastY.current = y
    }
    function onScroll() {
      if (!ticking.current) {
        ticking.current = true
        window.requestAnimationFrame(update)
      }
    }
    lastY.current = window.scrollY
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return hidden
}


// Shared layout: auth gate + header + month bar, with the active route rendered
// in <Outlet>. Store and auth come from the shared context.
export default function App() {
  const { auth, store: s } = useStoreCtx()
  const { month } = s
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editable, setEditable] = useState(false) // page starts read-only
  const headerHidden = useHideOnScroll()

  // Edit mode is page-local: reset to read-only whenever the route changes so
  // toggling Edit on one page never carries over after navigating away.
  useEffect(() => {
    setEditable(false)
  }, [location.pathname])

  // The month bar (month picker, add/delete month, backup) belongs to the
  // dashboard and the credit-card screens (spends + insights) — all operate on
  // the active month. Hide it on Settings and any other route.
  const showMonthBar = location.pathname === '/' || location.pathname.startsWith('/credit-cards')

  // The floating action button is shown on every page EXCEPT the read-only
  // insights view, where nothing is editable and there's no primary add action.
  const showFab = location.pathname !== '/credit-cards/insights'

  // Auth is only enforced when Supabase is configured.
  if (auth.configured) {
    if (auth.loading) {
      return <div className="app center-msg">Loading…</div>
    }
    if (!auth.user) {
      return <Login onGoogle={auth.signInWithGoogle} />
    }
  }

  return (
    <div className="app">
      <AppHeader
        auth={auth}
        onNavigate={navigate}
        onToggleMenu={() => setMenuOpen(true)}
        hidden={headerHidden}
      />
      <NavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={navigate} auth={auth} />

      {showMonthBar && (
        <MonthBar
          month={month}
          months={s.months}
          switchMonth={s.switchMonth}
          addMonth={s.addMonth}
          deleteMonth={s.deleteMonth}
          exportJSON={s.exportJSON}
          importJSON={s.importJSON}
          syncState={s.syncState}
          syncError={s.syncError}
          auth={auth}
          editable={editable}
        />
      )}

      <PageActionsProvider>
        <EditModeProvider editable={editable}>
          <Outlet />
          {/* One floating action button for the whole app: it fans out Add (when
              the page registers a primary add) plus Edit/Save. Hidden on the
              read-only insights view. */}
          {showFab && (
            <FabMenu
              editable={editable}
              onToggleEdit={() => setEditable(e => !e)}
              onSave={() => setEditable(false)}
              onCancel={() => setEditable(false)}
            />
          )}
        </EditModeProvider>
      </PageActionsProvider>

      <footer className="app-foot">
        {auth.configured
          ? 'Synced to your account across devices. A local copy is kept for offline use.'
          : 'Data is stored locally in this browser. Use Export to back up.'}
      </footer>
    </div>
  )
}
