import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useStoreCtx } from './context/StoreContext.jsx'
import { EditModeProvider } from './context/EditModeContext.jsx'
import { MonthBar } from './components/MonthBar.jsx'
import { AppHeader } from './components/AppHeader.jsx'
import { NavDrawer } from './components/NavDrawer.jsx'
import { Login } from './components/Login.jsx'

// Shared layout: auth gate + header + month bar, with the active route rendered
// in <Outlet>. Store and auth come from the shared context.
export default function App() {
  const { auth, store: s } = useStoreCtx()
  const { month } = s
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editable, setEditable] = useState(false) // page starts read-only

  // The month bar (month picker, edit toggle, backup) belongs to the dashboard
  // and the credit-card screens (spends + insights) — all operate on the active
  // month. Hide it on Settings and any other route.
  const showMonthBar = location.pathname === '/' || location.pathname.startsWith('/credit-cards')

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
          onToggleEdit={() => setEditable(e => !e)}
        />
      )}

      <EditModeProvider editable={editable}>
        <Outlet />
      </EditModeProvider>

      <footer className="app-foot">
        {auth.configured
          ? 'Synced to your account across devices. A local copy is kept for offline use.'
          : 'Data is stored locally in this browser. Use Export to back up.'}
      </footer>
    </div>
  )
}
