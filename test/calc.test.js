import { describe, it, expect } from 'vitest'
import {
  totalAvailable,
  totalBankBalance,
  billsTotal,
  billsPending,
  billsCount,
  bankRequired,
  bankExtra,
  budgetTotals,
  remainingBudget,
  summary,
  dateTracker,
  creditCardTotal,
  creditCardBreakdown,
  categoryBreakdown,
  monthlyInsights,
} from '../src/lib/calc.js'

// A fixture matching the numbers in the user's spreadsheet screenshot.
const IDFC = 'idfc'
const HDFC = 'hdfc'
const CASH = 'cash'

const month = {
  id: '2026-08',
  holdings: [
    { id: 'h2', label: 'Monika', amount: 150000 },
  ],
  banks: [
    { id: IDFC, name: 'IDFC', actual: 23233, primary: true },
    { id: HDFC, name: 'HDFC', actual: 1000, primary: false },
    { id: CASH, name: 'Cash', actual: 0, primary: false },
  ],
  budget: [
    { id: 'b1', category: 'Personal Spend', spend: 0, budget: 15000 },
    { id: 'b2', category: 'House Spend', spend: 20000, budget: 50000 },
    { id: 'b3', category: 'Cuttack House', spend: 5000, budget: 10000 },
  ],
  bills: [
    { id: 'x1', name: 'Suman', bankId: IDFC, amount: 39703, paid: true },
    { id: 'x2', name: 'IDFC Credit', bankId: IDFC, amount: 712, paid: true },
    { id: 'x3', name: 'Kotak Loan', bankId: IDFC, amount: 37500, paid: true },
    { id: 'x4', name: 'SBI Loan', bankId: IDFC, amount: 27000, paid: true },
    { id: 'x5', name: 'Satya Loan', bankId: IDFC, amount: 13045, paid: true },
    { id: 'x6', name: 'Home Loan', bankId: IDFC, amount: 100000, paid: true },
    { id: 'x7', name: 'Kotak SIP', bankId: IDFC, amount: 10500, paid: true },
    { id: 'x8', name: 'Amazon ICICI Card', bankId: IDFC, amount: 0, paid: true },
    { id: 'x9', name: 'ICICI Card', bankId: IDFC, amount: 25667.58, paid: true },
    { id: 'x10', name: 'SBI Card', bankId: IDFC, amount: 31715, paid: true },
    { id: 'x11', name: 'HDFC Credit', bankId: IDFC, amount: 123139, paid: false },
    { id: 'x12', name: 'HDFC Rupay Card', bankId: IDFC, amount: 56930, paid: false },
    { id: 'x13', name: 'Pintu', bankId: IDFC, amount: 90000, paid: false },
    { id: 'x14', name: 'Ritu', bankId: IDFC, amount: 250000, paid: false },
  ],
}

describe('Total Balance', () => {
  it('Total Bank Balance = sum of bank actuals (24,233)', () => {
    expect(totalBankBalance(month)).toBe(24233)
  })
  it('Total Available = Total Bank Balance + unchecked holdings (174,233)', () => {
    // 24233 (banks) + 150000 (Monika, not excluded)
    expect(totalAvailable(month)).toBe(174233)
  })
  it('excludes checked (excluded) holdings from Total Available', () => {
    const withChecked = { ...month, holdings: [{ id: 'h2', label: 'Monika', amount: 150000, excluded: true }] }
    expect(totalAvailable(withChecked)).toBe(24233) // only the bank balance remains
  })
  it('counts an unchecked income-derived holding, drops it once checked', () => {
    const base = { ...month, holdings: [{ id: 'i1', riId: 'ri1', label: 'Salary', amount: 5000, excluded: false }] }
    expect(totalAvailable(base)).toBe(24233 + 5000)
    const received = { ...base, holdings: [{ ...base.holdings[0], excluded: true }] }
    expect(totalAvailable(received)).toBe(24233)
  })
  it('Total Bank Balance is 0 when there are no banks', () => {
    expect(totalBankBalance({ id: '2026-09' })).toBe(0)
    expect(totalAvailable({ id: '2026-09', holdings: [{ id: 'h', amount: 500 }] })).toBe(500)
  })
})

describe('Bills & EMIs', () => {
  it('total is 805,911.58', () => {
    expect(billsTotal(month)).toBeCloseTo(805911.58, 2)
  })
  it('pending is 520,069', () => {
    // 123139 + 56930 + 90000 + 250000
    expect(billsPending(month)).toBe(520069)
  })
  it('count is 10/14', () => {
    expect(billsCount(month)).toEqual({ paid: 10, total: 14 })
  })
})

describe('Budget', () => {
  it('column totals are 25,000 / 75,000 / 50,000', () => {
    const t = budgetTotals(month)
    expect(t.spend).toBe(25000)
    expect(t.budget).toBe(75000)
    expect(t.left).toBe(50000)
  })
  it('remaining budget folds into primary bank', () => {
    expect(remainingBudget(month)).toBe(50000)
  })
})

describe('Bank Balance', () => {
  it('IDFC (primary) Required = pending 520,069 + remaining budget 50,000 = 570,069', () => {
    const idfc = month.banks[0]
    expect(bankRequired(month, idfc)).toBe(570069)
    expect(bankExtra(month, idfc)).toBe(23233 - 570069)
  })
  it('non-primary bank Required = only its own unpaid bills (0 here)', () => {
    const hdfc = month.banks[1]
    expect(bankRequired(month, hdfc)).toBe(0)
    expect(bankExtra(month, hdfc)).toBe(1000)
  })
})

describe('Summary', () => {
  it('extra = available - total spend', () => {
    const s = summary(month)
    expect(s.available).toBe(174233)
    expect(s.spend).toBe(570069) // sum of all bank Required
    expect(s.extra).toBe(174233 - 570069)
  })
})

describe('Date tracker', () => {
  it('derives start/end from the month id and computes days from a fixed today', () => {
    const today = new Date(2026, 7, 11) // Aug 11 2026, local time
    const { daysPassed, daysLeft, startDate, endDate } = dateTracker(month, today)
    expect(startDate).toBe('2026-08-01')
    expect(endDate).toBe('2026-08-31')
    expect(daysPassed).toBe(10) // Aug 1 -> Aug 11
    expect(daysLeft).toBe(20) // Aug 11 -> Aug 31
  })
})

describe('Credit card spends total', () => {
  const AMEX = 'card-amex'
  const HDFC_CARD = 'card-hdfc'
  const spendMonth = {
    id: '2026-08',
    creditCards: [
      { id: 'ccs1', cardId: AMEX, categoryId: 'scat-food', amount: 1200, notes: '' },
      { id: 'ccs2', cardId: AMEX, categoryId: 'scat-fuel', amount: 800, notes: '' },
      { id: 'ccs3', cardId: HDFC_CARD, categoryId: 'scat-food', amount: 500, notes: '' },
      { id: 'ccs4', cardId: HDFC_CARD, categoryId: '', amount: 'oops', notes: '' },
    ],
  }

  it('returns 0 for a month with no spends', () => {
    expect(creditCardTotal({ id: '2026-09' })).toBe(0)
    expect(creditCardTotal({ id: '2026-09', creditCards: [] })).toBe(0)
  })
  it('sums across all cards when no filter is given', () => {
    expect(creditCardTotal(spendMonth)).toBe(2500) // 1200 + 800 + 500 (+ non-finite ignored)
  })
  it('filters by cardId', () => {
    expect(creditCardTotal(spendMonth, AMEX)).toBe(2000)
    expect(creditCardTotal(spendMonth, HDFC_CARD)).toBe(500)
  })
  it('ignores non-finite amounts', () => {
    expect(creditCardTotal(spendMonth, HDFC_CARD)).toBe(500) // 'oops' contributes 0
  })
})

describe('Insights breakdowns', () => {
  // Worked example: c1 has two spends (1000 + 500), c2 one (300), and cX one
  // (amount 'nan') whose card was deleted. Categories: cat1 twice (1000 + 300),
  // one blank (500), and catZ once (deleted, non-finite amount).
  const month = {
    id: '2026-08',
    creditCards: [
      { id: 's1', cardId: 'c1', categoryId: 'cat1', amount: 1000, notes: '' },
      { id: 's2', cardId: 'c1', categoryId: '', amount: 500, notes: '' },
      { id: 's3', cardId: 'c2', categoryId: 'cat1', amount: 300, notes: '' },
      { id: 's4', cardId: 'cX', categoryId: 'catZ', amount: 'nan', notes: '' },
    ],
  }
  const cards = [{ id: 'c1', name: 'HDFC' }, { id: 'c2', name: 'Amazon ICICI' }]
  const categories = [{ id: 'cat1', name: 'Groceries' }]

  it('groups by card, sorted by amount desc, with deleted + percent + count', () => {
    const { groups, total } = creditCardBreakdown(month, cards)
    expect(total).toBe(1800) // 1000 + 500 + 300 + 0 (nan)
    expect(groups.map(g => g.cardId)).toEqual(['c1', 'c2', 'cX'])
    expect(groups[0]).toMatchObject({ cardId: 'c1', name: 'HDFC', deleted: false, amount: 1500, count: 2 })
    expect(groups[1]).toMatchObject({ cardId: 'c2', name: 'Amazon ICICI', deleted: false, amount: 300, count: 1 })
    expect(groups[2]).toMatchObject({ cardId: 'cX', name: '(deleted)', deleted: true, amount: 0, count: 1 })
    expect(groups[0].percent).toBeCloseTo(83.333, 2)
    expect(groups[1].percent).toBeCloseTo(16.667, 2)
    expect(groups[2].percent).toBe(0)
  })

  it('groups by category with Uncategorized (blank) distinct from (deleted)', () => {
    const { groups, total } = categoryBreakdown(month, categories)
    expect(total).toBe(1800)
    expect(groups.map(g => g.categoryId)).toEqual(['cat1', '', 'catZ'])
    expect(groups[0]).toMatchObject({ name: 'Groceries', deleted: false, amount: 1300, count: 2 })
    expect(groups[1]).toMatchObject({ categoryId: '', name: 'Uncategorized', deleted: false, amount: 500, count: 1 })
    expect(groups[2]).toMatchObject({ categoryId: 'catZ', name: '(deleted)', deleted: true, amount: 0, count: 1 })
  })

  it('empty month yields empty groups and zero total', () => {
    expect(creditCardBreakdown({ id: '2026-09', creditCards: [] }, cards)).toEqual({ groups: [], total: 0 })
    expect(categoryBreakdown({ id: '2026-09' }, categories)).toEqual({ groups: [], total: 0 })
  })

  it('monthlyInsights wraps both breakdowns with a shared total', () => {
    const ins = monthlyInsights(month, { creditCards: cards, spendCategories: categories })
    expect(ins.total).toBe(1800)
    expect(ins.total).toBe(ins.byCard.total)
    expect(ins.total).toBe(ins.byCategory.total)
    expect(ins.byCard.groups).toHaveLength(3)
    expect(ins.byCategory.groups).toHaveLength(3)
  })

  it('does not mutate the source spends array', () => {
    const before = month.creditCards.map(s => s.id)
    creditCardBreakdown(month, cards)
    expect(month.creditCards.map(s => s.id)).toEqual(before)
  })
})
