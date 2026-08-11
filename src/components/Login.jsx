// Login screen shown when Supabase is configured but the user isn't signed in.
export function Login({ onGoogle }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Budget Tracker</h1>
        <p>Sign in to sync your budget across devices.</p>
        <button className="google-btn" onClick={onGoogle}>
          <span className="g-logo" aria-hidden>G</span>
          Sign in with Google
        </button>
        <p className="hint">Your data is stored privately in your own account.</p>
      </div>
    </div>
  )
}
