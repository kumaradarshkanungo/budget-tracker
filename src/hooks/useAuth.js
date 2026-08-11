import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

// Tracks the Supabase auth session. In local-only mode (no keys), returns a
// stable "not configured" state so the app skips the login gate entirely.
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signInWithGoogle() {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
  }
  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return {
    configured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    loading,
    signInWithGoogle,
    signOut,
  }
}
