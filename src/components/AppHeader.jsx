import { ProfileMenu } from './ProfileMenu.jsx'

// Top app header: hamburger (opens the nav drawer) + greeting + profile menu.
// The profile menu (avatar → sign out) only appears when signed in; in
// local-only mode we show a generic greeting and no account controls.
export function AppHeader({ auth, onNavigate, onToggleMenu }) {
  const user = auth?.user
  const meta = user?.user_metadata || {}
  // Prefer the full name (incl. middle name); fall back to email local-part.
  const fullName = meta.full_name || meta.name || (user?.email ? user.email.split('@')[0] : '')
  const signedIn = auth?.configured && !!user

  return (
    <header className="app-head">
      <button
        type="button"
        className="hamburger-btn"
        aria-label="Menu"
        onClick={onToggleMenu}
      >
        ☰
      </button>
      <h1 className="greeting" onClick={() => onNavigate('/')}>
        {signedIn ? (
          <>
            <span className="greet-lead">Hi, </span>
            {fullName}
          </>
        ) : (
          'Welcome'
        )}
      </h1>
      {signedIn && <ProfileMenu auth={auth} />}
    </header>
  )
}
