// Pure derivation layer. Every number the UI shows that isn't a raw input is
// computed here from a Month object. Kept side-effect free so it's easy to test.

import { monthStartDate, monthEndDate } from './storage.js'

const num = v => (Number.isFinite(v) ? v : 0)

// --- Total Balance --------------------------------------------------------
export function totalAvailable(month) {
  return (month.holdings || []).reduce((s, h) => s + num(h.amount), 0)
}

// --- Bills & EMIs ---------------------------------------------------------
export function billsTotal(month) {
  return (month.bills || []).reduce((s, b) => s + num(b.amount), 0)
}
export function billsPending(month) {
  return (month.bills || []).filter(b => !b.paid).reduce((s, b) => s + num(b.amount), 0)
}
export function billsCount(month) {
  const bills = month.bills || []
  return { paid: bills.filter(b => b.paid).length, total: bills.length }
}
// Unpaid bills that belong to a given bank.
export function unpaidForBank(month, bankId) {
  return (month.bills || [])
    .filter(b => !b.paid && b.bankId === bankId)
    .reduce((s, b) => s + num(b.amount), 0)
}

// --- Credit Card Spends ---------------------------------------------------
// Total of a month's card spends; optional cardId filter ('' = all cards).
export function creditCardTotal(month, cardId = '') {
  return (month.creditCards || [])
    .filter(s => !cardId || s.cardId === cardId)
    .reduce((sum, s) => sum + num(s.amount), 0)
}

// Shared grouping engine for the insights breakdowns. Buckets a month's spends
// by a key (cardId / categoryId), sums amounts (non-finite -> 0 via num, but the
// spend still counts), resolves each key to a display name via `resolve(key)`,
// and returns groups sorted by amount desc (name asc tie-break, for determinism)
// with each group's percent share of the month total (0 when total is 0).
function breakdownBy(month, keyOf, resolve) {
  const spends = month.creditCards || []
  const buckets = new Map()
  for (const s of spends) {
    const key = keyOf(s)
    const bucket = buckets.get(key) || { key, amount: 0, count: 0 }
    bucket.amount += num(s.amount)
    bucket.count += 1
    buckets.set(key, bucket)
  }
  const total = spends.reduce((sum, s) => sum + num(s.amount), 0)
  const groups = [...buckets.values()]
    .map(b => {
      const { name, deleted } = resolve(b.key)
      return {
        key: b.key,
        name,
        deleted,
        amount: b.amount,
        count: b.count,
        percent: total ? (b.amount / total) * 100 : 0,
      }
    })
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  return { groups, total }
}

// Per-card breakdown. `cards` is settings.creditCards ([{id,name}]). A spend's
// cardId not in that list resolves to '(deleted)'. groups items expose `cardId`.
export function creditCardBreakdown(month, cards = []) {
  const byId = new Map(cards.map(c => [c.id, c.name]))
  const { groups, total } = breakdownBy(
    month,
    s => s.cardId || '',
    key => (byId.has(key) ? { name: byId.get(key), deleted: false } : { name: '(deleted)', deleted: true }),
  )
  return { groups: groups.map(({ key, ...g }) => ({ cardId: key, ...g })), total }
}

// Per-category breakdown. `categories` is settings.spendCategories ([{id,name}]).
// A blank categoryId folds into a single 'Uncategorized' bucket (not deleted);
// a non-blank id absent from the list resolves to '(deleted)'.
export function categoryBreakdown(month, categories = []) {
  const byId = new Map(categories.map(c => [c.id, c.name]))
  const { groups, total } = breakdownBy(
    month,
    s => s.categoryId || '',
    key => {
      if (!key) return { name: 'Uncategorized', deleted: false }
      return byId.has(key) ? { name: byId.get(key), deleted: false } : { name: '(deleted)', deleted: true }
    },
  )
  return { groups: groups.map(({ key, ...g }) => ({ categoryId: key, ...g })), total }
}

// One-call wrapper for the insights overview (mirrors summary(month)). The three
// totals are equal — the same month-wide sum of all card spends.
export function monthlyInsights(month, settings = {}) {
  const byCard = creditCardBreakdown(month, settings.creditCards || [])
  const byCategory = categoryBreakdown(month, settings.spendCategories || [])
  return { total: byCard.total, byCard, byCategory }
}

// --- Budget ---------------------------------------------------------------
export function budgetRow(row) {
  const spend = num(row.spend)
  const budget = num(row.budget)
  return { spend, budget, left: budget - spend }
}
export function budgetTotals(month) {
  return (month.budget || []).reduce(
    (acc, r) => {
      const { spend, budget, left } = budgetRow(r)
      acc.spend += spend
      acc.budget += budget
      acc.left += left
      return acc
    },
    { spend: 0, budget: 0, left: 0 }
  )
}
// Remaining (unspent) budget across all categories — folded into the primary
// bank's Required, per the user's rule.
export function remainingBudget(month) {
  const t = budgetTotals(month)
  return t.budget - t.spend
}

// --- Bank Balance ---------------------------------------------------------
// Required = unpaid bills for this bank (+ remaining budget if primary bank).
export function bankRequired(month, bank) {
  const base = unpaidForBank(month, bank.id)
  return bank.primary ? base + remainingBudget(month) : base
}
export function bankActual(bank) {
  return num(bank.actual)
}
export function bankExtra(month, bank) {
  return bankActual(bank) - bankRequired(month, bank)
}

// --- Summary --------------------------------------------------------------
// Total Spend = sum of every bank's Required (equals total pending + remaining
// budget once). Extra = Available - Spend.
export function totalSpend(month) {
  return (month.banks || []).reduce((s, b) => s + bankRequired(month, b), 0)
}
export function summary(month) {
  const available = totalAvailable(month)
  const spend = totalSpend(month)
  return { available, spend, extra: available - spend }
}

// --- Date tracker ---------------------------------------------------------
const MS_PER_DAY = 24 * 60 * 60 * 1000
function atMidnight(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
// Parse an ISO "YYYY-MM-DD" as a LOCAL-time date (new Date('YYYY-MM-DD') would
// parse as UTC, causing off-by-one day counts in non-UTC zones).
function parseLocalDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
// today defaults to the real current date; injectable for tests.
// Start/End dates are DERIVED from the month id (first/last day of the month).
export function dateTracker(month, today = new Date()) {
  const t = atMidnight(today)
  const startStr = monthStartDate(month.id)
  const endStr = monthEndDate(month.id)
  const start = startStr ? atMidnight(parseLocalDate(startStr)) : null
  const end = endStr ? atMidnight(parseLocalDate(endStr)) : null
  const daysPassed = start ? Math.max(0, Math.round((t - start) / MS_PER_DAY)) : 0
  const daysLeft = end ? Math.max(0, Math.round((end - t) / MS_PER_DAY)) : 0
  return { daysPassed, daysLeft, startDate: startStr, endDate: endStr }
}
