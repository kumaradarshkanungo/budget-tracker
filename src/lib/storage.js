// Local persistence + store shape. The store is one JSON document:
//   { activeMonthId, months: { [id]: Month }, settings: { defaultBankName } }
// It's saved to localStorage (offline cache) and, when signed in, to Supabase.
//
// A Month is keyed by year-month "YYYY-MM". Its Start/End dates are DERIVED from
// that key (first and last day of the month) — not stored, not editable.

const STORAGE_KEY = 'budget-tracker-v1'

// Sentinel bankName for recurring-bill templates that should follow the month's
// DEFAULT (primary) bank rather than a fixed bank name. Resolved per-month at
// materialization (see resolveBankId), so a template tagged with this tracks
// whichever bank is primary in each month — including future default changes.
// The double-underscore convention won't collide with a human-typed bank name,
// and the bank dropdown never offers it as a name.
export const DEFAULT_BANK = '__default__'

// Resolve a template's bankName against a month's banks. The DEFAULT_BANK
// sentinel maps to that month's primary bank (dynamic, per-month); a real name
// matches by name; anything unresolved falls back to '' (untagged) — the same
// behavior a name with no matching bank has always had.
function resolveBankId(bankName, banks) {
  const list = banks || []
  if (bankName === DEFAULT_BANK) return list.find(b => b.primary)?.id || ''
  return list.find(b => b.name === bankName)?.id || ''
}

// Small id helper that does NOT use Math.random at module load — safe & unique enough.
let _seq = 0
export function uid(prefix = 'id') {
  _seq += 1
  return `${prefix}-${Date.now().toString(36)}-${_seq}`
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// "2026-08" -> "August 2026"
export function labelForMonthId(id) {
  const [y, m] = String(id).split('-').map(Number)
  if (!y || !m) return id
  return `${MONTH_NAMES[m - 1]} ${y}`
}

// First day of the month, ISO date string. "2026-08" -> "2026-08-01"
export function monthStartDate(id) {
  const [y, m] = String(id).split('-')
  if (!y || !m) return ''
  return `${y}-${m.padStart(2, '0')}-01`
}

// Number of days in the given "YYYY-MM" month. "2026-02" -> 28.
function daysInMonth(id) {
  const [y, m] = String(id).split('-').map(Number)
  if (!y || !m) return 31
  return new Date(y, m, 0).getDate() // day 0 of next month = last day of this
}

// The calendar month before the given "YYYY-MM" id, handling the year rollover.
// "2026-09" -> "2026-08", "2026-01" -> "2025-12". Returns '' on invalid input.
export function prevMonthId(id) {
  const [y, m] = String(id).split('-').map(Number)
  if (!y || !m) return ''
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  return `${py}-${String(pm).padStart(2, '0')}`
}

// The current calendar month as "YYYY-MM". `today` is injectable so tests can
// pin "now" deterministically (mirrors calc.js dateTracker(month, today)).
export function currentMonthId(today = new Date()) {
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

// Ids of the store's FUTURE months — those strictly after the current calendar
// month (the same set syncRecurringToFutureMonths re-syncs). `today` is
// injectable for deterministic tests. Used to report how many months a manual
// sync will touch.
export function futureMonthIds(store, today = new Date()) {
  const cur = currentMonthId(today)
  return Object.keys(store?.months || {}).filter(id => id > cur)
}

// Sum of a given card's spends in a month. Inlined here (rather than importing
// creditCardTotal from calc.js) because calc.js imports from this module, so the
// reverse import would create a cycle. Mirrors creditCardTotal(month, cardId).
function sumCardSpends(month, cardId) {
  return (month?.creditCards || [])
    .filter(s => s.cardId === cardId)
    .reduce((n, s) => n + (Number.isFinite(s.amount) ? s.amount : 0), 0)
}

// Last day of the month, ISO date string. "2026-08" -> "2026-08-31"
export function monthEndDate(id) {
  const [y, m] = String(id).split('-').map(Number)
  if (!y || !m) return ''
  const last = daysInMonth(id)
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

// ---- Seed data (August 2026), matching the source spreadsheet ------------
function seedMonth() {
  const IDFC = uid('bank')
  const HDFC = uid('bank')
  const CASH = uid('bank')
  return {
    id: '2026-08',
    holdings: [
      { id: uid('h'), label: 'Monika', amount: 150000 },
    ],
    banks: [
      { id: IDFC, name: 'IDFC', actual: 23233, primary: true },
      { id: HDFC, name: 'HDFC', actual: 1000, primary: false },
      { id: CASH, name: 'Cash', actual: 0, primary: false },
    ],
    budget: [
      { id: uid('bg'), category: 'Personal Spend', spend: 0, budget: 15000 },
      { id: uid('bg'), category: 'House Spend', spend: 20000, budget: 50000 },
      { id: uid('bg'), category: 'Cuttack House', spend: 5000, budget: 10000 },
    ],
    bills: [
      { id: uid('b'), date: '2026-08-01', name: 'Suman', bankId: IDFC, amount: 39703, paid: true },      { id: uid('b'), date: '2026-08-01', name: 'IDFC Credit', bankId: IDFC, amount: 712, paid: true },
      { id: uid('b'), date: '2026-08-01', name: 'Kotak Loan', bankId: IDFC, amount: 37500, paid: true },
      { id: uid('b'), date: '2026-08-02', name: 'SBI Loan', bankId: IDFC, amount: 27000, paid: true },
      { id: uid('b'), date: '2026-06-05', name: 'Satya Loan', bankId: IDFC, amount: 13045, paid: true },
      { id: uid('b'), date: '2026-06-05', name: 'Home Loan', bankId: IDFC, amount: 100000, paid: true },
      { id: uid('b'), date: '2026-06-05', name: 'Kotak SIP', bankId: IDFC, amount: 10500, paid: true },
      { id: uid('b'), date: '2026-06-05', name: 'Amazon ICICI Card', bankId: IDFC, amount: 0, paid: true },
      { id: uid('b'), date: '2026-06-05', name: 'ICICI Card', bankId: IDFC, amount: 25667.58, paid: true },
      { id: uid('b'), date: '2026-06-10', name: 'SBI Card', bankId: IDFC, amount: 31715, paid: true },
      { id: uid('b'), date: '2026-06-20', name: 'HDFC Credit', bankId: IDFC, amount: 123139, paid: false },
      { id: uid('b'), date: '2026-06-20', name: 'HDFC Rupay Card', bankId: IDFC, amount: 56930, paid: false },
      { id: uid('b'), date: '', name: 'Pintu', bankId: IDFC, amount: 90000, paid: false },
      { id: uid('b'), date: '', name: 'Ritu', bankId: IDFC, amount: 250000, paid: false },
    ],
    creditCards: [],
  }
}

export function defaultStore() {
  const m = seedMonth()
  return {
    activeMonthId: m.id,
    months: { [m.id]: m },
    settings: { defaultBankName: 'IDFC', creditCards: [], spendCategories: [], recurringBills: [], recurringIncomes: [] },
  }
}

// Normalize any loaded store so older/partial documents get the new fields.
export function normalizeStore(store) {
  if (!store || !store.months || !Object.keys(store.months).length) return defaultStore()
  const settings = { defaultBankName: '', creditCards: [], spendCategories: [], recurringBills: [], recurringIncomes: [], ...(store.settings || {}) }
  // MIGRATION: the old computed "Available" holding is now derived (Total Bank
  // Balance = sum of bank actuals) and no longer stored. Drop it — but ONLY from
  // an UNMIGRATED month, and only the machine-created row (index 0, no riId,
  // label 'Available'). A month is "migrated" once any holding carries riId or
  // an `excluded` flag, so this runs at most once and never deletes a user's
  // own later "Available" holding.
  const months = {}
  for (const [id, m] of Object.entries(store.months)) {
    const holdings = m.holdings || []
    const migrated = holdings.some(h => h.riId || 'excluded' in h)
    const cleaned = migrated
      ? holdings
      : holdings.filter((h, i) => !(i === 0 && !h.riId && h.label === 'Available'))
    months[id] = { ...m, holdings: cleaned }
  }
  return { ...store, settings, months }
}

// The per-month data groups a selective export/import operates on. `id` is
// always carried (it's the row/month identity), never a selectable group.
export const PER_MONTH_KEYS = ['holdings', 'banks', 'budget', 'bills', 'creditCards']

// The global settings lists that get merged by row id on import (plus the
// scalar `defaultBankName`, handled separately).
const SETTINGS_LISTS = ['creditCards', 'spendCategories', 'recurringBills', 'recurringIncomes']

// Build a filtered backup document from a store. `monthIds` selects which months
// to include; `perMonthKeys` selects which per-month data groups to keep on each
// (defaults to all); `includeGlobal` decides whether `settings` is embedded.
// Pure — used both by the export modal and unit tests.
export function selectStore(store, { monthIds, perMonthKeys = PER_MONTH_KEYS, includeGlobal = true } = {}) {
  const ids = monthIds && monthIds.length ? monthIds : Object.keys(store.months || {})
  const keys = perMonthKeys && perMonthKeys.length ? perMonthKeys : []
  const months = {}
  for (const id of ids) {
    const m = store.months?.[id]
    if (!m) continue
    const picked = { id: m.id }
    for (const k of keys) if (k in m) picked[k] = m[k]
    months[id] = picked
  }
  const out = { activeMonthId: store.activeMonthId, months }
  if (includeGlobal && store.settings) out.settings = store.settings
  return out
}

// Upsert an incoming array into an existing one by row `id`: entries with a
// matching id replace the existing row; new ids are appended; rows absent from
// `incoming` are left untouched. Rows without an id (shouldn't happen) append.
function mergeById(existing = [], incoming = []) {
  if (!incoming.length) return existing
  const out = existing.slice()
  const idx = new Map(out.map((r, i) => [r.id, i]))
  for (const row of incoming) {
    if (row && row.id != null && idx.has(row.id)) out[idx.get(row.id)] = row
    else out.push(row)
  }
  return out
}

// Merge a (possibly partial) backup document into the current store WITHOUT
// wiping data the file omits. Months present in `incoming` are merged group-by-
// group and row-by-row (see mergeById); months absent stay as they were; a month
// id not yet in the store is added. Settings lists merge by id; `defaultBankName`
// is overwritten only if the file carries a truthy value. A full backup upserts
// everything → same end state as a replace. Returns a fresh store object.
export function mergeStore(current, incoming) {
  if (!incoming || typeof incoming !== 'object') return current
  const months = { ...(current.months || {}) }
  for (const [id, inMonth] of Object.entries(incoming.months || {})) {
    const base = months[id] || { id }
    const merged = { ...base, id }
    for (const k of PER_MONTH_KEYS) {
      if (Array.isArray(inMonth[k])) merged[k] = mergeById(base[k], inMonth[k])
    }
    months[id] = merged
  }
  const settings = { ...(current.settings || {}) }
  const inSettings = incoming.settings
  if (inSettings) {
    for (const list of SETTINGS_LISTS) {
      if (Array.isArray(inSettings[list])) settings[list] = mergeById(settings[list], inSettings[list])
    }
    if (inSettings.defaultBankName) settings.defaultBankName = inSettings.defaultBankName
  }
  return { ...current, months, settings }
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStore()
    return normalizeStore(JSON.parse(raw))
  } catch {
    return defaultStore()
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Quota / private mode — ignore; app still works in-memory this session.
  }
}

// Turn the global "Repeated Bills & EMIs" templates into concrete bills for a
// given month. Each template stores only the DAY (1–31), name, bank NAME and
// amount — the year+month come from monthId. The day is clamped to the month's
// last day (so day 31 in February lands on the 28th/29th). Bank is resolved by
// NAME against the month's banks (ids are regenerated per month), falling back
// to untagged when there's no match; the DEFAULT_BANK sentinel resolves to the
// month's primary bank instead (see resolveBankId). New bills always start unpaid.
//
// A template with type 'card' represents a credit-card payment: its NAME is the
// card's name (from opts.cards) and, when the template amount is 0/blank, its
// AMOUNT is prefetched from that card's total spends in opts.prevMonth (the
// calendar month before this one). A non-zero template amount is treated as a
// manual override and used as-is.
export function materializeRecurringBills(monthId, recurringBills, banks, opts = {}) {
  const { prevMonth = null, cards = [] } = opts
  const [y, m] = String(monthId).split('-')
  const yy = Number(y)
  const mm = Number(m)
  if (!yy || !mm) return []
  const last = daysInMonth(monthId)
  return (recurringBills || []).map(tpl => {
    const d = Number(tpl.day)
    let date = ''
    if (Number.isFinite(d) && d >= 1) {
      const day = Math.min(d, last)
      date = `${yy}-${String(mm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    let name = tpl.name || ''
    let amount = tpl.amount || 0
    if (tpl.type === 'card') {
      name = cards.find(c => c.id === tpl.cardId)?.name || ''
      // Blank/zero template amount → prefetch from the prior month's card spends.
      if (!amount) amount = sumCardSpends(prevMonth, tpl.cardId)
    }

    const bank = resolveBankId(tpl.bankName, banks)
    return {
      id: uid('b'),
      date,
      name,
      bankId: bank,
      amount,
      paid: false,
      // Provenance: rbId links the bill back to its template so template edits
      // can propagate to future months (see syncRecurringToFutureMonths).
      // amountAuto stays true while the amount is template/prefetch-derived; the
      // UI flips it to false once the user edits this bill's amount directly.
      rbId: tpl.id,
      amountAuto: true,
    }
  })
}

// Turn the global recurring-income templates into concrete holdings for a month.
// Each template holds only { id, name, amount }. Materialized holdings carry an
// riId (provenance, mirrors bills' rbId) and start UNCHECKED (excluded:false) —
// money yet to be received, so it counts toward Total Available until the user
// checks it (received into a bank).
export function materializeRecurringIncomes(incomes) {
  return (incomes || []).map(tpl => ({
    id: uid('h'),
    riId: tpl.id,
    label: tpl.name || '',
    amount: tpl.amount || 0,
    excluded: false,
  }))
}

// Build a fresh month for the given "YYYY-MM" id. Carries over bank names and
// budget categories from a template month (amounts zeroed). Marks the settings
// default bank as primary if present, else keeps the template's primary. Seeds
// the month's bills from the global recurring-bill templates in settings —
// credit-card templates prefetch their amount from prevMonth's card spends — and
// its holdings from the global recurring-income templates (each unchecked).
export function newMonthFor(monthId, template, defaultBankName, settings, prevMonth) {
  let banks = (template?.banks || []).map(b => ({ ...b, id: uid('bank'), actual: 0 }))
  const budget = (template?.budget || []).map(b => ({ ...b, id: uid('bg'), spend: 0 }))
  if (!banks.length) banks = [{ id: uid('bank'), name: defaultBankName || 'Bank', actual: 0, primary: true }]

  // Apply the default-bank preference: make it primary, others not.
  if (defaultBankName) {
    const match = banks.find(b => b.name === defaultBankName)
    if (match) banks = banks.map(b => ({ ...b, primary: b.id === match.id }))
  }
  return {
    id: monthId,
    holdings: materializeRecurringIncomes(settings?.recurringIncomes || []),
    banks,
    budget,
    bills: materializeRecurringBills(monthId, settings?.recurringBills || [], banks, {
      prevMonth,
      cards: settings?.creditCards || [],
    }),
    creditCards: [],
  }
}

export { STORAGE_KEY }

// Re-derive one month's bills from the given recurring-bill templates, PRESERVING
// user state. Pure — returns a NEW bills array (does not mutate `month`).
//
// - Bills WITHOUT an rbId are treated as manual and passed through untouched
//   (this is the back-compat safety key: propagation never deletes/rewrites them).
// - Each template produces exactly one bill. If a matching bill already existed
//   (same rbId) its stable id, paid flag, and — when amountAuto === false — its
//   manually-entered amount are preserved. Name/day-derived date/bank are always
//   re-resolved from the template against THIS month.
// - Template bills whose template no longer exists are dropped.
export function applyTemplatesToMonth(month, recurringBills, opts = {}) {
  const { cards = [], prevMonth = null } = opts
  const templates = recurringBills || []
  const tplIds = new Set(templates.map(t => t.id))
  const banks = month?.banks || []
  const last = daysInMonth(month?.id)
  const existing = month?.bills || []

  // Keep every manual (rbId-less) bill exactly as-is.
  const manual = existing.filter(b => !b.rbId)
  // Index surviving template bills by their template id for state preservation.
  const byRb = new Map(existing.filter(b => b.rbId && tplIds.has(b.rbId)).map(b => [b.rbId, b]))

  const fromTemplates = templates.map(tpl => {
    const prev = byRb.get(tpl.id)

    // Date from THIS month + template day (clamped to the month's last day).
    const d = Number(tpl.day)
    let date = ''
    if (Number.isFinite(d) && d >= 1) {
      date = `${month.id}-${String(Math.min(d, last)).padStart(2, '0')}`
    }

    // Name — card templates name themselves after the card.
    let name = tpl.name || ''
    if (tpl.type === 'card') name = cards.find(c => c.id === tpl.cardId)?.name || ''

    // Bank re-resolved by NAME against THIS month's banks (ids differ per
    // month); the DEFAULT_BANK sentinel resolves to this month's primary bank.
    const bankId = resolveBankId(tpl.bankName, banks)

    // Amount — preserve a manual override; else recompute from the template
    // (card templates prefetch from THIS month's prior month card spends).
    const isAuto = prev ? prev.amountAuto !== false : true
    let amount
    if (!isAuto) {
      amount = prev.amount
    } else if (tpl.type === 'card') {
      amount = tpl.amount || sumCardSpends(prevMonth, tpl.cardId)
    } else {
      amount = tpl.amount || 0
    }

    return {
      id: prev?.id || uid('b'),
      date,
      name,
      bankId,
      amount,
      paid: prev ? !!prev.paid : false,
      rbId: tpl.id,
      amountAuto: isAuto,
    }
  })

  return [...manual, ...fromTemplates]
}

// Re-derive one month's income-derived holdings from the recurring-income
// templates, PRESERVING user state. Pure — returns a NEW holdings array.
//
// - Holdings WITHOUT an riId are manual → passed through untouched (the same
//   back-compat safety key as bills' rbId-less rows).
// - Each template yields exactly one holding. A surviving match (same riId)
//   keeps its stable id and its `excluded` (checked) flag; label and amount are
//   always re-derived from the template (templates own the amount — there is no
//   per-month amount override for incomes).
// - Income holdings whose template no longer exists are dropped.
export function applyIncomesToMonth(month, incomes) {
  const templates = incomes || []
  const tplIds = new Set(templates.map(t => t.id))
  const existing = month?.holdings || []
  const manual = existing.filter(h => !h.riId)
  const byRi = new Map(existing.filter(h => h.riId && tplIds.has(h.riId)).map(h => [h.riId, h]))
  const fromTemplates = templates.map(tpl => {
    const prev = byRi.get(tpl.id)
    return {
      id: prev?.id || uid('h'),
      riId: tpl.id,
      label: tpl.name || '',
      amount: tpl.amount || 0,
      excluded: prev ? !!prev.excluded : false,
    }
  })
  return [...manual, ...fromTemplates]
}

// Propagate the current recurring-bill AND recurring-income templates to every
// whose id is strictly greater than the current calendar month. Pure — returns a
// NEW store (or the same reference if nothing changed). `today` is injectable for
// tests. prevMonth is read from the ORIGINAL store so iteration order is
// irrelevant (card amounts derive from spends, which this function never edits).
// Bills preserve paid + manual amounts; income holdings preserve their checked
// (excluded) flag; manual holdings are left untouched.
export function syncRecurringToFutureMonths(store, opts = {}) {
  const { today = new Date() } = opts
  const cur = currentMonthId(today)
  const templates = store.settings?.recurringBills || []
  const incomes = store.settings?.recurringIncomes || []
  const cards = store.settings?.creditCards || []
  const months = { ...store.months }
  let changed = false
  for (const id of Object.keys(months)) {
    if (id <= cur) continue // future = strictly greater than the current month
    const m = months[id]
    const prevMonth = store.months[prevMonthId(id)] || null
    months[id] = {
      ...m,
      bills: applyTemplatesToMonth(m, templates, { cards, prevMonth }),
      holdings: applyIncomesToMonth(m, incomes),
    }
    changed = true
  }
  return changed ? { ...store, months } : store
}

// Set the default/primary bank on a store. Pure — returns a new store.
// Records the choice in settings.defaultBankName (remembered for FUTURE months
// created via newMonthFor) and marks the matching bank primary on the ACTIVE
// month only. All OTHER months are returned untouched, so previous months keep
// whatever primary they already had. Passing an empty name clears the primary
// flag on the active month and the stored default.
export function applyDefaultBank(store, name) {
  const activeId = store.activeMonthId
  const cur = store.months[activeId]
  if (!cur) {
    return { ...store, settings: { ...(store.settings || {}), defaultBankName: name } }
  }
  const banks = (cur.banks || []).map(b => ({
    ...b,
    primary: name ? b.name === name : false,
  }))
  return {
    ...store,
    settings: { ...(store.settings || {}), defaultBankName: name },
    months: { ...store.months, [activeId]: { ...cur, banks } },
  }
}
