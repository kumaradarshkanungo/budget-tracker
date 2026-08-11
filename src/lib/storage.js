// Local persistence + store shape. The store is one JSON document:
//   { activeMonthId, months: { [id]: Month }, settings: { defaultBankName } }
// It's saved to localStorage (offline cache) and, when signed in, to Supabase.
//
// A Month is keyed by year-month "YYYY-MM". Its Start/End dates are DERIVED from
// that key (first and last day of the month) — not stored, not editable.

const STORAGE_KEY = 'budget-tracker-v1'

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

// Last day of the month, ISO date string. "2026-08" -> "2026-08-31"
export function monthEndDate(id) {
  const [y, m] = String(id).split('-').map(Number)
  if (!y || !m) return ''
  const last = new Date(y, m, 0).getDate() // day 0 of next month = last day of this
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
      { id: uid('h'), label: 'Available', amount: 24233 },
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
      { id: uid('b'), date: '2026-08-01', name: 'Suman', bankId: IDFC, amount: 39703, paid: true },
      { id: uid('b'), date: '2026-08-01', name: 'IDFC Credit', bankId: IDFC, amount: 712, paid: true },
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
    settings: { defaultBankName: 'IDFC', creditCards: [], spendCategories: [] },
  }
}

// Normalize any loaded store so older/partial documents get the new fields.
export function normalizeStore(store) {
  if (!store || !store.months || !Object.keys(store.months).length) return defaultStore()
  const settings = { defaultBankName: '', creditCards: [], spendCategories: [], ...(store.settings || {}) }
  return { ...store, settings }
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

// Build a fresh month for the given "YYYY-MM" id. Carries over bank names and
// budget categories from a template month (amounts zeroed). Marks the settings
// default bank as primary if present, else keeps the template's primary.
export function newMonthFor(monthId, template, defaultBankName) {
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
    holdings: [{ id: uid('h'), label: 'Available', amount: 0 }],
    banks,
    budget,
    bills: [],
    creditCards: [],
  }
}

export { STORAGE_KEY }

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
