import { supabase } from './supabase.js'

// The entire budget store is persisted as one JSONB document per user in the
// `budgets` table (columns: user_id uuid pk, data jsonb, updated_at timestamptz).
// This keeps sync trivial for a single-user personal document and works fine on
// a static host (Supabase is the backend). See supabase-schema.sql for setup.

const TABLE = 'budgets'

// Fetch the signed-in user's store, or null if they have no row yet.
export async function fetchRemoteStore(userId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[budget] Supabase fetch failed:', error.message, error)
    throw error
  }
  return data ? { store: data.data, updatedAt: data.updated_at } : null
}

// Upsert the store for a user. updated_at is set to now() by the DB default on
// insert; we pass it explicitly on update so last-write-wins ordering is clear.
export async function saveRemoteStore(userId, store) {
  if (!supabase) return
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, data: store, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) {
    console.error('[budget] Supabase save failed:', error.message, error)
    throw error
  }
}
