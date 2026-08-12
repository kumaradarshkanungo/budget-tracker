import { describe, it, expect } from 'vitest'
import {
  labelForMonthId,
  monthStartDate,
  monthEndDate,
  newMonthFor,
  normalizeStore,
  defaultStore,
  applyDefaultBank,
  materializeRecurringBills,
  prevMonthId,
} from '../src/lib/storage.js'

describe('month date derivation', () => {
  it('labels a year-month id', () => {
    expect(labelForMonthId('2026-08')).toBe('August 2026')
    expect(labelForMonthId('2026-02')).toBe('February 2026')
  })
  it('derives first day', () => {
    expect(monthStartDate('2026-08')).toBe('2026-08-01')
    expect(monthStartDate('2026-2')).toBe('2026-02-01')
  })
  it('derives last day, accounting for month length and leap years', () => {
    expect(monthEndDate('2026-08')).toBe('2026-08-31')
    expect(monthEndDate('2026-02')).toBe('2026-02-28')
    expect(monthEndDate('2028-02')).toBe('2028-02-29') // leap year
    expect(monthEndDate('2026-04')).toBe('2026-04-30')
  })
})

describe('newMonthFor', () => {
  const template = {
    id: '2026-08',
    banks: [
      { id: 'a', name: 'IDFC', actual: 100, primary: false },
      { id: 'b', name: 'HDFC', actual: 200, primary: true },
    ],
    budget: [{ id: 'x', category: 'House', spend: 500, budget: 1000 }],
    bills: [{ id: 'z', name: 'x', amount: 10, paid: false }],
  }
  it('carries banks/categories with zeroed amounts and no bills', () => {
    const m = newMonthFor('2026-09', template, '')
    expect(m.id).toBe('2026-09')
    expect(m.banks.map(b => b.name)).toEqual(['IDFC', 'HDFC'])
    expect(m.banks.every(b => b.actual === 0)).toBe(true)
    expect(m.budget[0].spend).toBe(0)
    expect(m.budget[0].budget).toBe(1000)
    expect(m.bills).toEqual([])
  })
  it('applies the default bank as primary', () => {
    const m = newMonthFor('2026-09', template, 'IDFC')
    const idfc = m.banks.find(b => b.name === 'IDFC')
    const hdfc = m.banks.find(b => b.name === 'HDFC')
    expect(idfc.primary).toBe(true)
    expect(hdfc.primary).toBe(false)
  })
})

describe('normalizeStore', () => {
  it('adds a settings object to legacy stores', () => {
    const legacy = { activeMonthId: '2026-08', months: { '2026-08': { id: '2026-08' } } }
    expect(normalizeStore(legacy).settings).toEqual({
      defaultBankName: '',
      creditCards: [],
      spendCategories: [],
      recurringBills: [],
    })
  })
  it('falls back to a seeded default store when empty', () => {
    // Note: defaultStore() mints fresh uids each call, so we can't deep-equal two
    // instances. Assert the shape/invariants a fallback must satisfy instead.
    for (const input of [null, { months: {} }]) {
      const s = normalizeStore(input)
      const ref = defaultStore()
      expect(s.activeMonthId).toBe(ref.activeMonthId)
      expect(Object.keys(s.months)).toEqual(Object.keys(ref.months))
      expect(s.settings).toEqual(ref.settings)
      const m = s.months[s.activeMonthId]
      expect(m.banks.map(b => b.name)).toEqual(['IDFC', 'HDFC', 'Cash'])
      expect(m.banks.filter(b => b.primary).map(b => b.name)).toEqual(['IDFC'])
      expect(m.bills).toHaveLength(14)
    }
  })
})

describe('applyDefaultBank', () => {
  // Two months. The PAST month (July) has HDFC primary; the ACTIVE month
  // (August) has IDFC primary. Switching the default to HDFC should touch only
  // August and leave July exactly as it was.
  const makeStore = () => ({
    activeMonthId: '2026-08',
    settings: { defaultBankName: 'IDFC' },
    months: {
      '2026-07': {
        id: '2026-07',
        banks: [
          { id: 'j1', name: 'IDFC', actual: 5, primary: false },
          { id: 'j2', name: 'HDFC', actual: 6, primary: true },
        ],
      },
      '2026-08': {
        id: '2026-08',
        banks: [
          { id: 'a1', name: 'IDFC', actual: 10, primary: true },
          { id: 'a2', name: 'HDFC', actual: 20, primary: false },
        ],
      },
    },
  })

  it('marks the chosen bank primary on the ACTIVE month (by name)', () => {
    const next = applyDefaultBank(makeStore(), 'HDFC')
    const aug = next.months['2026-08'].banks
    expect(aug.find(b => b.name === 'HDFC').primary).toBe(true)
    expect(aug.find(b => b.name === 'IDFC').primary).toBe(false)
  })

  it('records the choice in settings so FUTURE months inherit it', () => {
    const next = applyDefaultBank(makeStore(), 'HDFC')
    expect(next.settings.defaultBankName).toBe('HDFC')
    // newMonthFor consumes settings.defaultBankName for months created later.
    const sept = newMonthFor('2026-09', next.months['2026-08'], next.settings.defaultBankName)
    expect(sept.banks.find(b => b.name === 'HDFC').primary).toBe(true)
    expect(sept.banks.find(b => b.name === 'IDFC').primary).toBe(false)
  })

  it('leaves PREVIOUS months completely untouched', () => {
    const before = makeStore()
    const julyBefore = before.months['2026-07']
    const next = applyDefaultBank(before, 'HDFC')
    // Same reference and same value — July is not rebuilt or mutated.
    expect(next.months['2026-07']).toBe(julyBefore)
    expect(next.months['2026-07'].banks).toEqual([
      { id: 'j1', name: 'IDFC', actual: 5, primary: false },
      { id: 'j2', name: 'HDFC', actual: 6, primary: true },
    ])
  })

  it('does not mutate the input store', () => {
    const before = makeStore()
    applyDefaultBank(before, 'HDFC')
    expect(before.settings.defaultBankName).toBe('IDFC')
    expect(before.months['2026-08'].banks.find(b => b.name === 'IDFC').primary).toBe(true)
  })

  it('clears the primary flag on the active month when name is empty', () => {
    const next = applyDefaultBank(makeStore(), '')
    expect(next.settings.defaultBankName).toBe('')
    expect(next.months['2026-08'].banks.every(b => b.primary === false)).toBe(true)
    // Previous month still unchanged.
    expect(next.months['2026-07'].banks.find(b => b.name === 'HDFC').primary).toBe(true)
  })

  it('clears all primaries if the chosen name matches no bank on the active month', () => {
    const next = applyDefaultBank(makeStore(), 'AXIS')
    expect(next.settings.defaultBankName).toBe('AXIS')
    expect(next.months['2026-08'].banks.every(b => b.primary === false)).toBe(true)
  })
})

describe('materializeRecurringBills', () => {
  const banks = [
    { id: 'bank-idfc', name: 'IDFC' },
    { id: 'bank-hdfc', name: 'HDFC' },
  ]
  const templates = [
    { id: 'rb1', day: 5, name: 'Home Loan', bankName: 'IDFC', amount: 100000 },
    { id: 'rb2', day: 31, name: 'Month end', bankName: 'HDFC', amount: 500 },
    { id: 'rb3', day: '', name: 'No date', bankName: 'IDFC', amount: 10 },
    { id: 'rb4', day: 10, name: 'Unknown bank', bankName: 'NOPE', amount: 20 },
  ]

  it('builds the full date from the month year/month and the template day', () => {
    const bills = materializeRecurringBills('2026-09', templates, banks)
    expect(bills[0]).toMatchObject({ name: 'Home Loan', date: '2026-09-05', bankId: 'bank-idfc', paid: false })
  })

  it('clamps a day beyond the month length to the last day', () => {
    expect(materializeRecurringBills('2026-02', templates, banks)[1].date).toBe('2026-02-28')
    expect(materializeRecurringBills('2026-09', templates, banks)[1].date).toBe('2026-09-30')
  })

  it('leaves the date blank when the template has no day', () => {
    expect(materializeRecurringBills('2026-09', templates, banks)[2].date).toBe('')
  })

  it('resolves the bank by name and leaves it untagged when no bank matches', () => {
    const bills = materializeRecurringBills('2026-09', templates, banks)
    expect(bills[3]).toMatchObject({ name: 'Unknown bank', bankId: '' })
  })

  it('always starts materialized bills unpaid', () => {
    expect(materializeRecurringBills('2026-09', templates, banks).every(b => b.paid === false)).toBe(true)
  })

  it('returns an empty array for an invalid month id', () => {
    expect(materializeRecurringBills('bogus', templates, banks)).toEqual([])
  })
})

describe('newMonthFor seeds recurring bills', () => {
  const template = { banks: [{ id: 'x', name: 'IDFC', actual: 9, primary: true }], budget: [] }
  const settings = {
    defaultBankName: 'IDFC',
    recurringBills: [{ id: 'rb1', day: 5, name: 'Home Loan', bankName: 'IDFC', amount: 100000 }],
  }

  it('adds recurring bills to a newly created month, tagged to that month\'s bank id', () => {
    const m = newMonthFor('2026-09', template, 'IDFC', settings)
    expect(m.bills).toHaveLength(1)
    const idfc = m.banks.find(b => b.name === 'IDFC')
    expect(m.bills[0]).toMatchObject({ name: 'Home Loan', date: '2026-09-05', bankId: idfc.id, paid: false })
  })

  it('creates no bills when there are no recurring templates', () => {
    expect(newMonthFor('2026-09', template, 'IDFC', { recurringBills: [] }).bills).toEqual([])
    expect(newMonthFor('2026-09', template, 'IDFC', undefined).bills).toEqual([])
  })
})

describe('prevMonthId', () => {
  it('decrements within the same year', () => {
    expect(prevMonthId('2026-09')).toBe('2026-08')
    expect(prevMonthId('2026-12')).toBe('2026-11')
  })
  it('rolls over January to the previous December', () => {
    expect(prevMonthId('2026-01')).toBe('2025-12')
  })
  it('zero-pads the month', () => {
    expect(prevMonthId('2026-11')).toBe('2026-10')
    expect(prevMonthId('2026-02')).toBe('2026-01')
  })
  it('returns empty string on invalid input', () => {
    expect(prevMonthId('bogus')).toBe('')
    expect(prevMonthId('')).toBe('')
  })
})

describe('materializeRecurringBills — credit-card templates', () => {
  const banks = [{ id: 'bank-idfc', name: 'IDFC' }]
  const cards = [{ id: 'card-hdfc', name: 'HDFC Card' }]
  const prevMonth = {
    creditCards: [
      { id: 's1', cardId: 'card-hdfc', amount: 1200 },
      { id: 's2', cardId: 'card-hdfc', amount: 800 },
      { id: 's3', cardId: 'card-other', amount: 9999 },
    ],
  }

  it('names the bill after the card and prefetches the prior month total when amount is 0', () => {
    const tpl = [{ id: 'rb', type: 'card', cardId: 'card-hdfc', day: 20, bankName: 'IDFC', amount: 0 }]
    const bill = materializeRecurringBills('2026-09', tpl, banks, { prevMonth, cards })[0]
    expect(bill).toMatchObject({ name: 'HDFC Card', date: '2026-09-20', bankId: 'bank-idfc', amount: 2000, paid: false })
  })

  it('treats a non-zero template amount as a manual override', () => {
    const tpl = [{ id: 'rb', type: 'card', cardId: 'card-hdfc', day: 20, bankName: 'IDFC', amount: 555 }]
    expect(materializeRecurringBills('2026-09', tpl, banks, { prevMonth, cards })[0].amount).toBe(555)
  })

  it('prefetches 0 when there is no prior month', () => {
    const tpl = [{ id: 'rb', type: 'card', cardId: 'card-hdfc', day: 20, bankName: 'IDFC', amount: 0 }]
    expect(materializeRecurringBills('2026-09', tpl, banks, { cards })[0].amount).toBe(0)
  })

  it('resolves an unknown card to an empty name', () => {
    const tpl = [{ id: 'rb', type: 'card', cardId: 'gone', day: 20, bankName: 'IDFC', amount: 0 }]
    expect(materializeRecurringBills('2026-09', tpl, banks, { prevMonth, cards })[0].name).toBe('')
  })
})

describe('newMonthFor seeds card-type recurring bills', () => {
  const template = { banks: [{ id: 'x', name: 'IDFC', actual: 9, primary: true }], budget: [] }
  const settings = {
    defaultBankName: 'IDFC',
    creditCards: [{ id: 'card-hdfc', name: 'HDFC Card' }],
    recurringBills: [{ id: 'rb', type: 'card', cardId: 'card-hdfc', day: 15, bankName: 'IDFC', amount: 0 }],
  }
  const prevMonth = { creditCards: [{ id: 's1', cardId: 'card-hdfc', amount: 4321 }] }

  it('prefetches the card bill amount from the prior month', () => {
    const m = newMonthFor('2026-09', template, 'IDFC', settings, prevMonth)
    const idfc = m.banks.find(b => b.name === 'IDFC')
    expect(m.bills).toHaveLength(1)
    expect(m.bills[0]).toMatchObject({ name: 'HDFC Card', date: '2026-09-15', bankId: idfc.id, amount: 4321, paid: false })
  })
})
