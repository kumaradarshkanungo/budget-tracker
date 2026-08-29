import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  loadStore,
  saveStore,
  newMonthFor,
  normalizeStore,
  selectStore,
  mergeStore,
  labelForMonthId,
  applyDefaultBank,
  prevMonthId,
  syncRecurringToFutureMonths,
  futureMonthIds,
  uid,
} from '../lib/storage.js'
import { creditCardTotal } from '../lib/calc.js'
import { fetchRemoteStore, saveRemoteStore } from '../lib/remoteStore.js'
import { supabase } from '../lib/supabase.js'

// Central state hook. Holds the whole store, persists to localStorage on every
// change, and (when a userId is provided) syncs to Supabase with debounce.
export function useBudgetStore(userId) {
  const [store, setStore] = useState(loadStore)
  const [syncState, setSyncState] = useState('idle') // idle | loading | saving | saved | error | offline
  const [syncError, setSyncError] = useState('') // human-readable last error
  const saveTimer = useRef(null)
  const hydratedFor = useRef(null) // which userId we've already pulled remote data for
  const hydrationDone = useRef(false) // gate remote saves until the first pull completes
  const storeRef = useRef(store)
  storeRef.current = store

  // Reset hydration state as soon as the user changes (runs before the async
  // pull resolves), so the persist effect can't write stale/seed data.
  if (hydratedFor.current !== userId) {
    hydrationDone.current = false
  }

  // ---- Pull remote store once when a user signs in ----------------------
  useEffect(() => {
    if (!supabase || !userId) {
      // Local-only mode (or signed out): nothing to pull, saves are local-only.
      hydrationDone.current = true
      return
    }
    if (hydratedFor.current === userId) return
    hydratedFor.current = userId
    let cancelled = false
    setSyncState('loading')
    fetchRemoteStore(userId)
      .then(remote => {
        if (cancelled) return
        if (remote?.store) {
          // Remote wins on first load (multi-device authority lives in the cloud).
          setStore(normalizeStore(remote.store))
        } else {
          // No remote row yet — seed it from whatever we have locally.
          saveRemoteStore(userId, storeRef.current).catch(() => {})
        }
        hydrationDone.current = true
        setSyncState('saved')
      })
      .catch(err => {
        if (cancelled) return
        // Pull failed: allow local edits to still be pushed rather than staying stuck.
        hydrationDone.current = true
        setSyncError(err?.message || 'Unknown error')
        setSyncState('error')
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Reset hydration marker on sign-out so a later sign-in re-pulls.
  useEffect(() => {
    if (!userId) hydratedFor.current = null
  }, [userId])

  // ---- Persist: localStorage immediately, remote debounced --------------
  useEffect(() => {
    saveStore(store)
    if (!supabase || !userId) return
    // Don't push to the cloud until we've pulled the authoritative copy first,
    // otherwise a slow initial fetch could let the local seed clobber real data.
    if (!hydrationDone.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSyncState('saving')
    saveTimer.current = setTimeout(() => {
      saveRemoteStore(userId, store)
        .then(() => {
          setSyncError('')
          setSyncState('saved')
        })
        .catch(err => {
          setSyncError(err?.message || 'Unknown error')
          setSyncState('error')
        })
    }, 800)
    return () => saveTimer.current && clearTimeout(saveTimer.current)
  }, [store, userId])

  const month = store.months[store.activeMonthId]
  const settings = store.settings || { defaultBankName: '' }

  // Replace the active month via an updater function.
  const updateMonth = useCallback(updater => {
    setStore(prev => {
      const cur = prev.months[prev.activeMonthId]
      const next = typeof updater === 'function' ? updater(cur) : updater
      return { ...prev, months: { ...prev.months, [prev.activeMonthId]: next } }
    })
  }, [])

  // Editing the active month's credit-card SPENDS changes the amounts that
  // card-type recurring bills prefetch for the NEXT month onward. Those future
  // months are only recomputed by syncRecurringToFutureMonths, so after any spend
  // mutation we re-run that sync — this keeps future months' Bills & EMIs in step
  // with spends immediately, matching what template edits already do. (The current
  // month's own card bill derives from the PRIOR month's spends, so it is
  // deliberately unaffected.) Combine the month update and the sync into a SINGLE
  // setStore so both land in one render/persist pass.
  const mutateAndMaybeSync = useCallback((key, mutate) => {
    setStore(prev => {
      const cur = prev.months[prev.activeMonthId]
      const next = { ...prev, months: { ...prev.months, [prev.activeMonthId]: mutate(cur) } }
      return key === 'creditCards' ? syncRecurringToFutureMonths(next) : next
    })
  }, [])

  // Generic list helpers for the section arrays (holdings/banks/budget/bills).
  const addRow = useCallback(
    (key, row) => mutateAndMaybeSync(key, m => ({ ...m, [key]: [...(m[key] || []), row] })),
    [mutateAndMaybeSync]
  )
  const updateRow = useCallback(
    (key, id, patch) =>
      mutateAndMaybeSync(key, m => ({
        ...m,
        [key]: (m[key] || []).map(r => (r.id === id ? { ...r, ...patch } : r)),
      })),
    [mutateAndMaybeSync]
  )
  const deleteRow = useCallback(
    (key, id) => mutateAndMaybeSync(key, m => ({ ...m, [key]: (m[key] || []).filter(r => r.id !== id) })),
    [mutateAndMaybeSync]
  )

  // Reorder a row within its list by moving the row with id `fromId` to the
  // position currently held by `toId` (drag-and-drop). No-op if either id is
  // missing or they're the same. Mutating the stored array order is what lets the
  // Total Balance list "remember" positions: checked holdings only SORT to the
  // bottom for display, so unchecking one returns it to its stored slot.
  const reorderRow = useCallback((key, fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return
    mutateAndMaybeSync(key, m => {
      const list = m[key] || []
      const from = list.findIndex(r => r.id === fromId)
      const to = list.findIndex(r => r.id === toId)
      if (from === -1 || to === -1) return m
      const next = list.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return { ...m, [key]: next }
    })
  }, [mutateAndMaybeSync])

  // Add a bank (optionally named). Returns nothing; reflects immediately on the
  // main Bank Balance screen since banks live on the active month.
  const addBank = useCallback(
    (name = '') => {
      const isFirst = (month.banks || []).length === 0
      addRow('banks', { id: uid('bank'), name, actual: 0, primary: isFirst })
    },
    [addRow, month]
  )

  // Delete a bank and detach any bills tagged to it (so they aren't orphaned).
  // If the deleted bank was primary, promote the first remaining bank. If it was
  // the settings default, clear that too so it doesn't dangle.
  const deleteBank = useCallback(
    id =>
      setStore(prev => {
        const cur = prev.months[prev.activeMonthId]
        const target = (cur.banks || []).find(b => b.id === id)
        const wasPrimary = target?.primary
        let banks = (cur.banks || []).filter(b => b.id !== id)
        if (wasPrimary && banks.length && !banks.some(b => b.primary)) {
          banks = banks.map((b, i) => ({ ...b, primary: i === 0 }))
        }
        const bills = (cur.bills || []).map(bl =>
          bl.bankId === id ? { ...bl, bankId: '' } : bl
        )
        const settings = { ...(prev.settings || {}) }
        if (target && settings.defaultBankName === target.name) settings.defaultBankName = ''
        return {
          ...prev,
          settings,
          months: { ...prev.months, [prev.activeMonthId]: { ...cur, banks, bills } },
        }
      }),
    []
  )

  // Rename a bank; keep the settings default in sync if it pointed at the old name.
  const renameBank = useCallback(
    (id, name) =>
      setStore(prev => {
        const cur = prev.months[prev.activeMonthId]
        const target = (cur.banks || []).find(b => b.id === id)
        const banks = (cur.banks || []).map(b => (b.id === id ? { ...b, name } : b))
        const settings = { ...(prev.settings || {}) }
        if (target && settings.defaultBankName === target.name) settings.defaultBankName = name
        return {
          ...prev,
          settings,
          months: { ...prev.months, [prev.activeMonthId]: { ...cur, banks } },
        }
      }),
    []
  )

  // ---- Settings ----------------------------------------------------------
  const updateSettings = useCallback(patch => {
    setStore(prev => ({ ...prev, settings: { ...(prev.settings || {}), ...patch } }))
  }, [])

  // Set the default/primary bank. Applies to the CURRENT month immediately
  // (marks the matching bank primary by name) and is remembered for FUTURE
  // months. Previous months are left untouched — they keep their own primary.
  const setDefaultBank = useCallback(name => {
    setStore(prev => applyDefaultBank(prev, name))
  }, [])

  // ---- Credit cards (global master list in settings) --------------------
  // Cards are shared across all months; spends (per month) reference a card id.
  const addCard = useCallback(name => {
    const nm = String(name || '').trim()
    if (!nm) return
    setStore(prev => ({
      ...prev,
      settings: {
        ...(prev.settings || {}),
        creditCards: [...((prev.settings || {}).creditCards || []), { id: uid('card'), name: nm }],
      },
    }))
  }, [])

  const deleteCard = useCallback(id => {
    setStore(prev => ({
      ...prev,
      settings: {
        ...(prev.settings || {}),
        creditCards: ((prev.settings || {}).creditCards || []).filter(c => c.id !== id),
      },
    }))
  }, [])

  // ---- Spend categories (global master list in settings) ----------------
  // Renaming a category propagates everywhere since spends reference the id.
  const addSpendCategory = useCallback(name => {
    const nm = String(name || '').trim()
    if (!nm) return
    setStore(prev => ({
      ...prev,
      settings: {
        ...(prev.settings || {}),
        spendCategories: [...((prev.settings || {}).spendCategories || []), { id: uid('scat'), name: nm }],
      },
    }))
  }, [])

  const renameSpendCategory = useCallback((id, name) => {
    setStore(prev => ({
      ...prev,
      settings: {
        ...(prev.settings || {}),
        spendCategories: ((prev.settings || {}).spendCategories || []).map(c =>
          c.id === id ? { ...c, name } : c
        ),
      },
    }))
  }, [])

  const deleteSpendCategory = useCallback(id => {
    setStore(prev => ({
      ...prev,
      settings: {
        ...(prev.settings || {}),
        spendCategories: ((prev.settings || {}).spendCategories || []).filter(c => c.id !== id),
      },
    }))
  }, [])

  // ---- Recurring bills & EMIs (global master list in settings) ----------
  // Templates hold { day, name, bankName, amount, type, cardId }. type 'manual'
  // is a plain bill; type 'card' names itself after a credit card and prefetches
  // its amount from the prior month's spends at materialization. They're
  // materialized into a month's bills when that month is CREATED (see addMonth /
  // newMonthFor); editing/adding/deleting a template also re-syncs it into every
  // already-created FUTURE month (syncRecurringToFutureMonths), preserving each
  // bill's paid status and any manually-entered amount.
  const addRecurringBill = useCallback((tpl = {}) => {
    setStore(prev => {
      const next = {
        ...prev,
        settings: {
          ...(prev.settings || {}),
          recurringBills: [
            ...((prev.settings || {}).recurringBills || []),
            { id: uid('rb'), day: '', name: '', bankName: '', amount: 0, type: 'manual', cardId: '', ...tpl },
          ],
        },
      }
      return syncRecurringToFutureMonths(next)
    })
  }, [])

  const updateRecurringBill = useCallback((id, patch) => {
    setStore(prev => {
      const next = {
        ...prev,
        settings: {
          ...(prev.settings || {}),
          recurringBills: ((prev.settings || {}).recurringBills || []).map(r =>
            r.id === id ? { ...r, ...patch } : r
          ),
        },
      }
      return syncRecurringToFutureMonths(next)
    })
  }, [])

  const deleteRecurringBill = useCallback(id => {
    setStore(prev => {
      const next = {
        ...prev,
        settings: {
          ...(prev.settings || {}),
          recurringBills: ((prev.settings || {}).recurringBills || []).filter(r => r.id !== id),
        },
      }
      return syncRecurringToFutureMonths(next)
    })
  }, [])

  // Manually re-apply the current templates to every FUTURE month on demand
  // (the same sync that runs automatically on template edits). Useful after
  // editing credit-card SPENDS — which feed card-type bill amounts but don't
  // themselves trigger a sync — or to refresh months created before auto-sync
  // existed. Preserves paid status and manually-entered amounts. Returns the
  // number of future months affected so the UI can confirm the action.
  const syncRecurringNow = useCallback(() => {
    const count = futureMonthIds(storeRef.current).length
    setStore(prev => syncRecurringToFutureMonths(prev))
    return count
  }, [])

  // ---- Recurring incomes (global master list in settings) ---------------
  // Templates hold { id, name, amount } plus optional { startMonth, endMonth }
  // "YYYY-MM" bounds (blank = unbounded). Materialized into a month's holdings
  // when the month is created (newMonthFor) — only for months inside the
  // [startMonth, endMonth] window; add/update/delete here also re-syncs them into
  // every already-created FUTURE month (syncRecurringToFutureMonths), preserving
  // each holding's checked (excluded) flag and any manual (non-income) holdings.
  // Toggling a holding's checkbox reuses the generic updateRow('holdings', id,
  // { excluded }).
  const addRecurringIncome = useCallback((tpl = {}) => {
    setStore(prev => {
      const next = {
        ...prev,
        settings: {
          ...(prev.settings || {}),
          recurringIncomes: [
            ...((prev.settings || {}).recurringIncomes || []),
            { id: uid('ri'), name: '', amount: 0, startMonth: '', endMonth: '', ...tpl },
          ],
        },
      }
      return syncRecurringToFutureMonths(next)
    })
  }, [])

  const updateRecurringIncome = useCallback((id, patch) => {
    setStore(prev => {
      const next = {
        ...prev,
        settings: {
          ...(prev.settings || {}),
          recurringIncomes: ((prev.settings || {}).recurringIncomes || []).map(r =>
            r.id === id ? { ...r, ...patch } : r
          ),
        },
      }
      return syncRecurringToFutureMonths(next)
    })
  }, [])

  const deleteRecurringIncome = useCallback(id => {
    setStore(prev => {
      const next = {
        ...prev,
        settings: {
          ...(prev.settings || {}),
          recurringIncomes: ((prev.settings || {}).recurringIncomes || []).filter(r => r.id !== id),
        },
      }
      return syncRecurringToFutureMonths(next)
    })
  }, [])

  // ---- Recurring EMIs (global master list in settings) ------------------
  // Templates hold { id, name, cardId, amount, startMonth, endMonth }. An EMI is
  // NOT materialized as its own bill or spend row; instead, a card-linked EMI
  // (cardId set) folds into the NEXT month's card payable: for month M, the card
  // bill amount = that card's prior-month spends + Σ EMIs linked to the card that
  // are active in month M-1 (see emiAddonForCard in storage.js). An unlinked EMI
  // (blank cardId) materializes nothing — it's a reference-only list entry. The
  // [startMonth, endMonth] window is inclusive (blank = unbounded). Add/update/
  // delete re-syncs future months so their card payables recompute immediately;
  // hand-edited (amountAuto:false) card bills are preserved.
  const addRecurringEmi = useCallback((tpl = {}) => {
    setStore(prev => {
      const next = {
        ...prev,
        settings: {
          ...(prev.settings || {}),
          recurringEmis: [
            ...((prev.settings || {}).recurringEmis || []),
            { id: uid('emi'), name: '', cardId: '', amount: 0, startMonth: '', endMonth: '', ...tpl },
          ],
        },
      }
      return syncRecurringToFutureMonths(next)
    })
  }, [])

  const updateRecurringEmi = useCallback((id, patch) => {
    setStore(prev => {
      const next = {
        ...prev,
        settings: {
          ...(prev.settings || {}),
          recurringEmis: ((prev.settings || {}).recurringEmis || []).map(r =>
            r.id === id ? { ...r, ...patch } : r
          ),
        },
      }
      return syncRecurringToFutureMonths(next)
    })
  }, [])

  const deleteRecurringEmi = useCallback(id => {
    setStore(prev => {
      const next = {
        ...prev,
        settings: {
          ...(prev.settings || {}),
          recurringEmis: ((prev.settings || {}).recurringEmis || []).filter(r => r.id !== id),
        },
      }
      return syncRecurringToFutureMonths(next)
    })
  }, [])

  // Add a credit-card bill to the ACTIVE month's Bills & EMIs. Its name is the
  // card's name and its amount is prefetched from that card's total spends in the
  // calendar prior month (0 if there's no prior month). Date is left blank for
  // the user to set inline; amount stays editable afterward. Tagged to the
  // primary bank (or first bank) by default.
  const addCardBill = useCallback(cardId => {
    setStore(prev => {
      const cards = (prev.settings || {}).creditCards || []
      const card = cards.find(c => c.id === cardId)
      if (!card) return prev
      const cur = prev.months[prev.activeMonthId]
      const prevMonth = prev.months[prevMonthId(prev.activeMonthId)]
      const amount = prevMonth ? creditCardTotal(prevMonth, cardId) : 0
      const banks = cur.banks || []
      const bankId = (banks.find(b => b.primary) || banks[0])?.id || ''
      const bill = { id: uid('b'), date: '', name: card.name, bankId, amount, paid: false }
      return {
        ...prev,
        months: { ...prev.months, [prev.activeMonthId]: { ...cur, bills: [...(cur.bills || []), bill] } },
      }
    })
  }, [])

  // ---- Month management --------------------------------------------------
  const months = useMemo(
    () =>
      Object.values(store.months)
        .map(m => ({ ...m, label: labelForMonthId(m.id) }))
        .sort((a, b) => (a.id < b.id ? 1 : -1)),
    [store.months]
  )
  const switchMonth = useCallback(id => setStore(prev => ({ ...prev, activeMonthId: id })), [])

  // Add a month by "YYYY-MM" id (from the month picker). No-op if it exists.
  const addMonth = useCallback(monthId => {
    if (!/^\d{4}-\d{2}$/.test(monthId)) return
    setStore(prev => {
      if (prev.months[monthId]) return { ...prev, activeMonthId: monthId }
      const tmpl = prev.months[prev.activeMonthId]
      const prevMonth = prev.months[prevMonthId(monthId)]
      const m = newMonthFor(monthId, tmpl, prev.settings?.defaultBankName, prev.settings, prevMonth)
      return { ...prev, activeMonthId: monthId, months: { ...prev.months, [monthId]: m } }
    })
  }, [])

  const deleteMonth = useCallback(id => {
    setStore(prev => {
      const remaining = { ...prev.months }
      delete remaining[id]
      const ids = Object.keys(remaining)
      if (!ids.length) return prev // never delete the last month
      const active = prev.activeMonthId === id ? ids.sort().reverse()[0] : prev.activeMonthId
      return { ...prev, activeMonthId: active, months: remaining }
    })
  }, [])

  // Replace the entire store. Used by edit-mode Cancel / navigate-away to DISCARD
  // all edits made since Edit was tapped: the caller passes a deep snapshot taken
  // when edit mode was entered. Routing through setStore re-runs the persist
  // effect (localStorage immediately + debounced remote save), so the discard is
  // durable across reload and devices.
  const restoreStore = useCallback(snapshot => {
    if (snapshot) setStore(snapshot)
  }, [])

  // ---- Backup: export / import JSON --------------------------------------
  const exportJSON = useCallback(() => JSON.stringify(store, null, 2), [store])
  // Selective export: filter to chosen months / data groups / global settings.
  // `selection` = { monthIds, perMonthKeys, includeGlobal }; omitted fields
  // default to "everything" (see selectStore).
  const exportSelectionJSON = useCallback(
    selection => JSON.stringify(selectStore(store, selection || {}), null, 2),
    [store]
  )
  // Import MERGES the file into the current store (upsert by month id + row id),
  // so a partial backup never wipes data the file omits. A full backup upserts
  // everything → same result as a replace. Accepts a file that carries months
  // OR settings (partial/settings-only files are valid).
  const importJSON = useCallback(text => {
    const parsed = JSON.parse(text)
    const hasMonths = parsed?.months && Object.keys(parsed.months).length
    const hasSettings = parsed?.settings && Object.keys(parsed.settings).length
    if (!hasMonths && !hasSettings) throw new Error('Invalid backup file')
    setStore(prev => normalizeStore(mergeStore(prev, parsed)))
  }, [])

  return {
    store,
    month,
    months,
    settings,
    syncState,
    syncError,
    updateMonth,
    addRow,
    updateRow,
    deleteRow,
    reorderRow,
    addBank,
    deleteBank,
    renameBank,
    updateSettings,
    setDefaultBank,
    addCard,
    deleteCard,
    addSpendCategory,
    renameSpendCategory,
    deleteSpendCategory,
    addRecurringBill,
    updateRecurringBill,
    deleteRecurringBill,
    syncRecurringNow,
    addRecurringIncome,
    updateRecurringIncome,
    deleteRecurringIncome,
    addRecurringEmi,
    updateRecurringEmi,
    deleteRecurringEmi,
    addCardBill,
    switchMonth,
    addMonth,
    deleteMonth,
    restoreStore,
    exportJSON,
    exportSelectionJSON,
    importJSON,
  }
}
