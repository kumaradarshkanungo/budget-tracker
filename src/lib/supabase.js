import { createClient } from '@supabase/supabase-js'

// Supabase is configured via Vite env vars (set in a .env file — see .env.example).
// If they're absent, the app runs in pure local mode (no login, localStorage only).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

// A single shared client, or null when not configured.
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
