import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Simple inline icons (stroke follows currentColor).
const IconWallet = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
    <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a3 3 0 0 1-3-3Z" />
    <circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)
const IconGear = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
)

const IconCard = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" />
    <path d="M6 15h4" />
  </svg>
)

const IconBills = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h9l3 3v15a1 1 0 0 1-1.5.87L15 20l-1.5.87L12 20l-1.5.87L9 20l-1.5.87L6 20V2Z" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </svg>
)

const IconSignOut = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
)

const NAV_ITEMS = [
  { label: 'Budget Tracker', path: '/', Icon: IconWallet },
  { label: 'Credit Card Spends', path: '/credit-cards', Icon: IconCard },
  { label: 'Manage Bills & EMIs', path: '/manage-bills', Icon: IconBills },
  { label: 'Settings', path: '/settings', Icon: IconGear },
]

// Slide-in navigation drawer from the left. Closes on backdrop click, Escape,
// or selecting an item. Rendered always (for the slide transition); the `.open`
// class drives the transform. Highlights the active route. When signed in, the
// header doubles as an account panel (avatar + name + email + sign out).
export function NavDrawer({ open, onClose, onNavigate, auth }) {
  const { pathname } = useLocation()

  const user = auth?.user
  const meta = user?.user_metadata || {}
  const signedIn = auth?.configured && !!user
  const fullName = meta.full_name || meta.name || (user?.email ? user.email.split('@')[0] : '')
  const avatarUrl = meta.avatar_url || meta.picture || ''
  const initial = (fullName || user?.email || '?').trim().charAt(0).toUpperCase()

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function go(path) {
    onNavigate(path)
    onClose()
  }

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'open' : ''}`} onClick={onClose} aria-hidden={!open} />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          {signedIn ? (
            <div className="drawer-account">
              {avatarUrl ? (
                <img className="drawer-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="drawer-avatar drawer-avatar-fallback">{initial}</span>
              )}
              <span className="drawer-account-text">
                <span className="drawer-account-name">{fullName}</span>
                {user?.email && <span className="drawer-account-email">{user.email}</span>}
              </span>
            </div>
          ) : (
            <span className="drawer-brand">
              <span className="drawer-brand-mark">₹</span>
              <span className="drawer-brand-text">Budget Tracker</span>
            </span>
          )}
          <button type="button" className="drawer-close" aria-label="Close menu" onClick={onClose}>
            ✕
          </button>
        </div>
        <nav className="drawer-nav">
          {NAV_ITEMS.map(({ label, path, Icon }) => {
            const active = pathname === path
            return (
              <button
                key={path}
                type="button"
                className={`drawer-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => go(path)}
              >
                <span className="drawer-item-icon"><Icon /></span>
                <span className="drawer-item-label">{label}</span>
              </button>
            )
          })}
        </nav>
        {signedIn ? (
          <div className="drawer-foot">
            <button type="button" className="drawer-signout" onClick={auth.signOut}>
              <IconSignOut />
              <span>Sign out</span>
            </button>
          </div>
        ) : (
          <div className="drawer-foot drawer-foot-note">Track your monthly budget</div>
        )}
      </aside>
    </>
  )
}
