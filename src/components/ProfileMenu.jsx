import { useEffect, useRef, useState } from 'react'

// Avatar button that reveals a small popover with the user's identity and a
// Sign out action. Closes on outside-click or Escape.
export function ProfileMenu({ auth }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const user = auth.user
  const meta = user?.user_metadata || {}
  const name = meta.full_name || meta.name || ''
  const email = user?.email || ''
  const avatar = meta.avatar_url || meta.picture || ''
  const initial = (name || email || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="profile-menu" ref={ref}>
      <button
        type="button"
        className="avatar-btn"
        aria-label="Account"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {avatar ? (
          <img className="avatar" src={avatar} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar avatar-fallback" aria-hidden>{initial}</span>
        )}
      </button>

      {open && (
        <div className="profile-pop" role="menu">
          <div className="profile-pop-id">
            {name && <div className="profile-pop-name">{name}</div>}
            {email && <div className="profile-pop-email">{email}</div>}
          </div>
          <button
            type="button"
            className="mb-btn profile-signout"
            onClick={() => {
              setOpen(false)
              auth.signOut()
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
