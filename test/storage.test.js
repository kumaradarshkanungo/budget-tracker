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
  currentMonthId,
  applyTemplatesToMonth,
  syncRecurringToFutureMonths,
  futureMonthIds,
  materializeRecurringIncomes,
  applyIncomesToMonth,
  selectStore,
  mergeStore,
  PER_MONTH_KEYS,
  DEFAULT_BANK,
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
      recurringIncomes: [],
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

  // MIGRATION: the old machine-created "Available" holding (index 0, no riId) is
  // now derived (Total Bank Balance) and must be dropped — but exactly once, and
  // never a user's own later "Available" or a post-migration store.
  it('drops the legacy index-0 "Available" holding from an unmigrated month', () => {
    const store = {
      activeMonthId: '2026-08',
      months: {
        '2026-08': {
          id: '2026-08',
          holdings: [
            { id: 'h1', label: 'Available', amount: 24233 },
            { id: 'h2', label: 'Monika', amount: 150000 },
          ],
        },
      },
    }
    const holdings = normalizeStore(store).months['2026-08'].holdings
    expect(holdings.map(h => h.label)).toEqual(['Monika'])
  })

  it('keeps a user "Available" holding that is not at index 0', () => {
    const store = {
      activeMonthId: '2026-08',
      months: {
        '2026-08': {
          id: '2026-08',
          holdings: [
            { id: 'h2', label: 'Monika', amount: 150000 },
            { id: 'h1', label: 'Available', amount: 999 },
          ],
        },
      },
    }
    const holdings = normalizeStore(store).months['2026-08'].holdings
    expect(holdings.map(h => h.label)).toEqual(['Monika', 'Available'])
  })

  it('does not re-drop once a month is migrated (has riId or excluded flags)', () => {
    // A migrated month whose FIRST holding is a user "Available" must be preserved.
    const store = {
      activeMonthId: '2026-08',
      months: {
        '2026-08': {
          id: '2026-08',
          holdings: [
            { id: 'h1', label: 'Available', amount: 500, excluded: false },
            { id: 'i1', riId: 'ri1', label: 'Salary', amount: 5000, excluded: true },
          ],
        },
      },
    }
    const holdings = normalizeStore(store).months['2026-08'].holdings
    expect(holdings.map(h => h.label)).toEqual(['Available', 'Salary'])
  })

  it('leaves an income-derived holding at index 0 untouched even if labeled "Available"', () => {
    const store = {
      activeMonthId: '2026-08',
      months: {
        '2026-08': {
          id: '2026-08',
          holdings: [{ id: 'i1', riId: 'ri1', label: 'Available', amount: 5000, excluded: false }],
        },
      },
    }
    const holdings = normalizeStore(store).months['2026-08'].holdings
    expect(holdings.map(h => h.label)).toEqual(['Available'])
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

describe('applyDefaultBank — future-month propagation', () => {
  const today = new Date(2026, 7, 15) // August 2026 → currentMonthId '2026-08'
  // A DEFAULT_BANK-tagged EMI template — its bill should follow the default bank.
  const templates = [
    { id: 'rb1', day: 5, name: 'Home Loan', bankName: DEFAULT_BANK, amount: 100000, type: 'manual' },
  ]
  // Past (July), active (August), and future (September) months. All have both
  // banks; IDFC is primary everywhere to start. The future month's EMI is tagged
  // to whatever bank is primary (DEFAULT_BANK) — so it currently points at IDFC.
  const makeStore = () => ({
    activeMonthId: '2026-08',
    settings: { defaultBankName: 'IDFC', recurringBills: templates, creditCards: [] },
    months: {
      '2026-07': {
        id: '2026-07',
        banks: [
          { id: 'j-idfc', name: 'IDFC', actual: 5, primary: true },
          { id: 'j-hdfc', name: 'HDFC', actual: 6, primary: false },
        ],
        bills: [{ id: 'b-jul', date: '2026-07-05', name: 'Home Loan', bankId: 'j-idfc', amount: 100000, paid: false, rbId: 'rb1', amountAuto: true }],
        holdings: [],
      },
      '2026-08': {
        id: '2026-08',
        banks: [
          { id: 'a-idfc', name: 'IDFC', actual: 10, primary: true },
          { id: 'a-hdfc', name: 'HDFC', actual: 20, primary: false },
        ],
        bills: [{ id: 'b-aug', date: '2026-08-05', name: 'Home Loan', bankId: 'a-idfc', amount: 100000, paid: false, rbId: 'rb1', amountAuto: true }],
        holdings: [],
      },
      '2026-09': {
        id: '2026-09',
        banks: [
          { id: 's-idfc', name: 'IDFC', actual: 0, primary: true },
          { id: 's-hdfc', name: 'HDFC', actual: 0, primary: false },
        ],
        bills: [{ id: 'b-sep', date: '2026-09-05', name: 'Home Loan', bankId: 's-idfc', amount: 100000, paid: false, rbId: 'rb1', amountAuto: true }],
        holdings: [],
      },
    },
  })

  it('marks the new default primary on FUTURE months too', () => {
    const next = applyDefaultBank(makeStore(), 'HDFC', { today })
    const sep = next.months['2026-09'].banks
    expect(sep.find(b => b.name === 'HDFC').primary).toBe(true)
    expect(sep.find(b => b.name === 'IDFC').primary).toBe(false)
  })

  it('re-resolves DEFAULT_BANK-tagged future EMIs onto the new default bank', () => {
    const next = applyDefaultBank(makeStore(), 'HDFC', { today })
    // September's EMI followed the default: it now points at HDFC (s-hdfc).
    const sepBill = next.months['2026-09'].bills.find(b => b.rbId === 'rb1')
    expect(sepBill.bankId).toBe('s-hdfc')
    // Active month's EMI also re-resolves to the new primary.
    const augBank = next.months['2026-08'].banks.find(b => b.name === 'HDFC')
    expect(augBank.primary).toBe(true)
  })

  it('leaves PAST months (and their EMIs) untouched', () => {
    const before = makeStore()
    const julyBefore = before.months['2026-07']
    const next = applyDefaultBank(before, 'HDFC', { today })
    expect(next.months['2026-07']).toBe(julyBefore)
    expect(next.months['2026-07'].banks.find(b => b.name === 'IDFC').primary).toBe(true)
    expect(next.months['2026-07'].bills[0].bankId).toBe('j-idfc')
  })

  it('does not mutate the input store', () => {
    const before = makeStore()
    applyDefaultBank(before, 'HDFC', { today })
    expect(before.settings.defaultBankName).toBe('IDFC')
    expect(before.months['2026-09'].banks.find(b => b.name === 'IDFC').primary).toBe(true)
    expect(before.months['2026-09'].bills[0].bankId).toBe('s-idfc')
  })

  it('preserves paid status + manual amounts on future EMIs while re-pointing the bank', () => {
    const store = makeStore()
    store.months['2026-09'].bills[0].paid = true
    store.months['2026-09'].bills[0].amountAuto = false
    store.months['2026-09'].bills[0].amount = 55555 // manual override
    const next = applyDefaultBank(store, 'HDFC', { today })
    const sepBill = next.months['2026-09'].bills.find(b => b.rbId === 'rb1')
    expect(sepBill.paid).toBe(true)
    expect(sepBill.amount).toBe(55555)
    expect(sepBill.bankId).toBe('s-hdfc')
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

  it('resolves the DEFAULT_BANK sentinel to the month\'s primary bank', () => {
    const withPrimary = [
      { id: 'bank-idfc', name: 'IDFC', primary: false },
      { id: 'bank-hdfc', name: 'HDFC', primary: true },
    ]
    const tpl = [{ id: 'rbd', day: 3, name: 'Rent', bankName: DEFAULT_BANK, amount: 100 }]
    expect(materializeRecurringBills('2026-09', tpl, withPrimary)[0].bankId).toBe('bank-hdfc')
  })

  it('leaves a DEFAULT_BANK bill untagged when the month has no primary bank', () => {
    const noPrimary = [
      { id: 'bank-idfc', name: 'IDFC', primary: false },
      { id: 'bank-hdfc', name: 'HDFC', primary: false },
    ]
    const tpl = [{ id: 'rbd', day: 3, name: 'Rent', bankName: DEFAULT_BANK, amount: 100 }]
    expect(materializeRecurringBills('2026-09', tpl, noPrimary)[0].bankId).toBe('')
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

describe('currentMonthId', () => {
  it('formats an injected date as YYYY-MM', () => {
    expect(currentMonthId(new Date(2026, 1, 3))).toBe('2026-02') // Feb (0-indexed month)
    expect(currentMonthId(new Date(2026, 11, 31))).toBe('2026-12')
  })
  it('zero-pads single-digit months', () => {
    expect(currentMonthId(new Date(2026, 0, 1))).toBe('2026-01') // January
    expect(currentMonthId(new Date(2027, 8, 9))).toBe('2027-09')
  })
  it('defaults to now and returns a YYYY-MM string', () => {
    expect(currentMonthId()).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('materializeRecurringBills — provenance stamping', () => {
  const banks = [{ id: 'bank-idfc', name: 'IDFC' }]
  const templates = [{ id: 'rb1', day: 5, name: 'Home Loan', bankName: 'IDFC', amount: 100000 }]

  it('stamps rbId (the template id) and amountAuto:true on each materialized bill', () => {
    const bill = materializeRecurringBills('2026-09', templates, banks)[0]
    expect(bill).toMatchObject({ name: 'Home Loan', rbId: 'rb1', amountAuto: true })
  })
})

describe('syncRecurringToFutureMonths', () => {
  const today = new Date(2026, 7, 15) // August 2026 → currentMonthId '2026-08'
  const cards = [{ id: 'card-hdfc', name: 'HDFC Card' }]
  const templates = [
    { id: 'rb1', day: 5, name: 'Home Loan', bankName: 'IDFC', amount: 100000, type: 'manual' },
  ]

  // A store with a past, current, and future month, all seeded from the template.
  const makeStore = (extra = {}) => ({
    activeMonthId: '2026-08',
    settings: { recurringBills: templates, creditCards: cards },
    months: {
      '2026-07': {
        id: '2026-07',
        banks: [{ id: 'j-idfc', name: 'IDFC' }],
        bills: [{ id: 'b-jul', date: '2026-07-05', name: 'Home Loan', bankId: 'j-idfc', amount: 100000, paid: true, rbId: 'rb1', amountAuto: true }],
      },
      '2026-08': {
        id: '2026-08',
        banks: [{ id: 'a-idfc', name: 'IDFC' }],
        bills: [{ id: 'b-aug', date: '2026-08-05', name: 'Home Loan', bankId: 'a-idfc', amount: 100000, paid: false, rbId: 'rb1', amountAuto: true }],
      },
      '2026-09': {
        id: '2026-09',
        banks: [{ id: 's-idfc', name: 'IDFC' }],
        bills: [{ id: 'b-sep', date: '2026-09-05', name: 'Home Loan', bankId: 's-idfc', amount: 100000, paid: false, rbId: 'rb1', amountAuto: true }],
        ...(extra.sep || {}),
      },
    },
  })

  it('leaves months at or before the current month untouched (same reference)', () => {
    const store = makeStore()
    const next = syncRecurringToFutureMonths(store, { today })
    expect(next.months['2026-07']).toBe(store.months['2026-07'])
    expect(next.months['2026-08']).toBe(store.months['2026-08'])
  })

  it('re-syncs only future months when a template changes', () => {
    const store = makeStore()
    // Rename the template; future month should pick up the new name.
    store.settings.recurringBills = [{ ...templates[0], name: 'Housing Loan' }]
    const next = syncRecurringToFutureMonths(store, { today })
    expect(next.months['2026-09'].bills[0].name).toBe('Housing Loan')
    // Past/current keep the old name (untouched).
    expect(next.months['2026-07'].bills[0].name).toBe('Home Loan')
    expect(next.months['2026-08'].bills[0].name).toBe('Home Loan')
  })

  it('preserves paid status on future template bills', () => {
    const store = makeStore({ sep: { bills: [{ id: 'b-sep', date: '2026-09-05', name: 'Home Loan', bankId: 's-idfc', amount: 100000, paid: true, rbId: 'rb1', amountAuto: true }] } })
    const next = syncRecurringToFutureMonths(store, { today })
    expect(next.months['2026-09'].bills[0].paid).toBe(true)
    expect(next.months['2026-09'].bills[0].id).toBe('b-sep') // stable id kept
  })

  it('preserves a manually-entered amount (amountAuto:false) but recomputes auto ones', () => {
    const store = makeStore({ sep: { bills: [{ id: 'b-sep', date: '2026-09-05', name: 'Home Loan', bankId: 's-idfc', amount: 55555, paid: false, rbId: 'rb1', amountAuto: false }] } })
    // Template amount changes to 200000.
    store.settings.recurringBills = [{ ...templates[0], amount: 200000 }]
    const next = syncRecurringToFutureMonths(store, { today })
    expect(next.months['2026-09'].bills[0].amount).toBe(55555) // manual override kept

    const store2 = makeStore() // sep bill is amountAuto:true
    store2.settings.recurringBills = [{ ...templates[0], amount: 200000 }]
    const next2 = syncRecurringToFutureMonths(store2, { today })
    expect(next2.months['2026-09'].bills[0].amount).toBe(200000) // recomputed
  })

  it('drops only the rbId bill when its template is removed, keeping manual bills', () => {
    const store = makeStore({ sep: { bills: [
      { id: 'b-sep', date: '2026-09-05', name: 'Home Loan', bankId: 's-idfc', amount: 100000, paid: false, rbId: 'rb1', amountAuto: true },
      { id: 'b-manual', date: '2026-09-20', name: 'Ad-hoc', bankId: 's-idfc', amount: 999, paid: false },
    ] } })
    store.settings.recurringBills = [] // template deleted
    const next = syncRecurringToFutureMonths(store, { today })
    const bills = next.months['2026-09'].bills
    expect(bills.map(b => b.id)).toEqual(['b-manual']) // rbId bill dropped, manual survives
  })

  it('recomputes card-bill amounts per month from each month\'s own prior month', () => {
    const cardTpl = [{ id: 'rbc', type: 'card', cardId: 'card-hdfc', day: 10, bankName: 'IDFC', amount: 0 }]
    const store = {
      activeMonthId: '2026-08',
      settings: { recurringBills: cardTpl, creditCards: cards },
      months: {
        // Prior months carry differing card spends.
        '2026-08': { id: '2026-08', banks: [{ id: 'x', name: 'IDFC' }], creditCards: [{ id: 's', cardId: 'card-hdfc', amount: 1000 }], bills: [] },
        '2026-09': { id: '2026-09', banks: [{ id: 'y', name: 'IDFC' }], creditCards: [{ id: 's2', cardId: 'card-hdfc', amount: 3000 }], bills: [{ id: 'b1', rbId: 'rbc', amountAuto: true, amount: 0, paid: false }] },
        '2026-10': { id: '2026-10', banks: [{ id: 'z', name: 'IDFC' }], bills: [{ id: 'b2', rbId: 'rbc', amountAuto: true, amount: 0, paid: false }] },
      },
    }
    const next = syncRecurringToFutureMonths(store, { today })
    // Sep bill derives from Aug spends (1000); Oct bill from Sep spends (3000).
    expect(next.months['2026-09'].bills[0].amount).toBe(1000)
    expect(next.months['2026-10'].bills[0].amount).toBe(3000)
  })
})

describe('applyTemplatesToMonth — back-compat with rbId-less bills', () => {
  const month = {
    id: '2026-12',
    banks: [{ id: 'idfc', name: 'IDFC' }],
    bills: [
      { id: 'old', date: '2026-12-05', name: 'Legacy Loan', bankId: 'idfc', amount: 100000, paid: true },
    ],
  }

  it('never touches or deletes bills without an rbId', () => {
    const templates = [{ id: 'rb1', day: 5, name: 'Home Loan', bankName: 'IDFC', amount: 100000, type: 'manual' }]
    const bills = applyTemplatesToMonth(month, templates, {})
    // The legacy bill survives verbatim...
    const legacy = bills.find(b => b.id === 'old')
    expect(legacy).toEqual(month.bills[0])
    // ...and the template additionally materializes as a fresh rbId bill.
    const fromTpl = bills.find(b => b.rbId === 'rb1')
    expect(fromTpl).toMatchObject({ name: 'Home Loan', date: '2026-12-05', amountAuto: true })
  })

  it('returns manual bills untouched when there are no templates', () => {
    const bills = applyTemplatesToMonth(month, [], {})
    expect(bills).toEqual(month.bills)
  })

  it('resolves a DEFAULT_BANK template to each month\'s own primary bank (dynamic)', () => {
    const tpl = [{ id: 'rbd', day: 5, name: 'Rent', bankName: DEFAULT_BANK, amount: 100, type: 'manual' }]
    // Same template, two months whose primary bank differs → each resolves locally.
    const monthA = {
      id: '2026-12',
      banks: [{ id: 'a1', name: 'IDFC', primary: true }, { id: 'a2', name: 'HDFC', primary: false }],
      bills: [],
    }
    const monthB = {
      id: '2027-01',
      banks: [{ id: 'b1', name: 'IDFC', primary: false }, { id: 'b2', name: 'HDFC', primary: true }],
      bills: [],
    }
    expect(applyTemplatesToMonth(monthA, tpl, {}).find(b => b.rbId === 'rbd').bankId).toBe('a1')
    expect(applyTemplatesToMonth(monthB, tpl, {}).find(b => b.rbId === 'rbd').bankId).toBe('b2')
  })
})

describe('futureMonthIds', () => {
  const today = new Date(2026, 7, 15) // August 2026 → currentMonthId '2026-08'
  const store = {
    months: {
      '2026-06': { id: '2026-06' },
      '2026-08': { id: '2026-08' }, // current — not future
      '2026-09': { id: '2026-09' },
      '2026-12': { id: '2026-12' },
    },
  }

  it('returns only months strictly after the current calendar month', () => {
    expect(futureMonthIds(store, today).sort()).toEqual(['2026-09', '2026-12'])
  })

  it('returns an empty array when no month is in the future', () => {
    const past = { months: { '2026-06': {}, '2026-07': {}, '2026-08': {} } }
    expect(futureMonthIds(past, today)).toEqual([])
    expect(futureMonthIds({ months: {} }, today)).toEqual([])
    expect(futureMonthIds({}, today)).toEqual([])
  })
})

describe('materializeRecurringIncomes', () => {
  it('turns income templates into unchecked holdings stamped with riId', () => {
    const incomes = [
      { id: 'ri1', name: 'Salary', amount: 50000 },
      { id: 'ri2', name: 'Rent received', amount: 15000 },
    ]
    const holdings = materializeRecurringIncomes(incomes)
    expect(holdings).toHaveLength(2)
    expect(holdings[0]).toMatchObject({ riId: 'ri1', label: 'Salary', amount: 50000, excluded: false })
    expect(holdings[1]).toMatchObject({ riId: 'ri2', label: 'Rent received', amount: 15000, excluded: false })
    expect(holdings.every(h => typeof h.id === 'string' && h.id)).toBe(true)
  })

  it('returns an empty array for no/blank incomes', () => {
    expect(materializeRecurringIncomes([])).toEqual([])
    expect(materializeRecurringIncomes(undefined)).toEqual([])
  })

  it('defaults a blank name/amount to empty/0', () => {
    expect(materializeRecurringIncomes([{ id: 'ri' }])[0]).toMatchObject({ label: '', amount: 0, excluded: false })
  })
})

describe('applyIncomesToMonth', () => {
  const incomes = [
    { id: 'ri1', name: 'Salary', amount: 50000 },
    { id: 'ri2', name: 'Rent', amount: 15000 },
  ]

  it('passes manual (riId-less) holdings through untouched', () => {
    const month = { holdings: [{ id: 'm1', label: 'Monika', amount: 150000 }] }
    const out = applyIncomesToMonth(month, [])
    expect(out).toEqual(month.holdings)
  })

  it('preserves a matched income holding\'s id and excluded flag, re-deriving label/amount', () => {
    const month = {
      holdings: [
        { id: 'keep', riId: 'ri1', label: 'Old name', amount: 1, excluded: true },
      ],
    }
    const out = applyIncomesToMonth(month, incomes)
    const salary = out.find(h => h.riId === 'ri1')
    expect(salary).toMatchObject({ id: 'keep', label: 'Salary', amount: 50000, excluded: true })
    // The second template materializes fresh, unchecked.
    const rent = out.find(h => h.riId === 'ri2')
    expect(rent).toMatchObject({ label: 'Rent', amount: 15000, excluded: false })
  })

  it('drops an income holding whose template no longer exists, keeping manual ones', () => {
    const month = {
      holdings: [
        { id: 'm1', label: 'Monika', amount: 150000 },
        { id: 'gone', riId: 'ri-removed', label: 'Old', amount: 100, excluded: false },
      ],
    }
    const out = applyIncomesToMonth(month, incomes)
    expect(out.some(h => h.riId === 'ri-removed')).toBe(false)
    expect(out.find(h => h.id === 'm1')).toMatchObject({ label: 'Monika', amount: 150000 })
    expect(out.filter(h => h.riId).map(h => h.riId).sort()).toEqual(['ri1', 'ri2'])
  })

  it('returns [manual, ...fromTemplates] with manual first', () => {
    const month = { holdings: [{ id: 'm1', label: 'Monika', amount: 1 }] }
    const out = applyIncomesToMonth(month, incomes)
    expect(out[0].id).toBe('m1')
    expect(out.slice(1).every(h => h.riId)).toBe(true)
  })
})

describe('newMonthFor seeds recurring incomes', () => {
  const template = { banks: [{ id: 'x', name: 'IDFC', actual: 9, primary: true }], budget: [] }

  it('materializes income holdings (unchecked) and no legacy "Available"', () => {
    const settings = { defaultBankName: 'IDFC', recurringIncomes: [{ id: 'ri1', name: 'Salary', amount: 50000 }] }
    const m = newMonthFor('2026-09', template, 'IDFC', settings)
    expect(m.holdings).toHaveLength(1)
    expect(m.holdings[0]).toMatchObject({ riId: 'ri1', label: 'Salary', amount: 50000, excluded: false })
    expect(m.holdings.some(h => h.label === 'Available' && !h.riId)).toBe(false)
  })

  it('creates no holdings when there are no income templates', () => {
    expect(newMonthFor('2026-09', template, 'IDFC', { recurringIncomes: [] }).holdings).toEqual([])
    expect(newMonthFor('2026-09', template, 'IDFC', undefined).holdings).toEqual([])
  })
})

describe('syncRecurringToFutureMonths — recurring incomes', () => {
  const today = new Date(2026, 7, 15) // August 2026 → currentMonthId '2026-08'
  const incomes = [{ id: 'ri1', name: 'Salary', amount: 50000 }]

  const makeStore = (extra = {}) => ({
    activeMonthId: '2026-08',
    settings: { recurringBills: [], recurringIncomes: incomes },
    months: {
      '2026-08': {
        id: '2026-08',
        banks: [{ id: 'a', name: 'IDFC' }],
        bills: [],
        holdings: [{ id: 'aug-i', riId: 'ri1', label: 'Salary', amount: 50000, excluded: false }],
      },
      '2026-09': {
        id: '2026-09',
        banks: [{ id: 's', name: 'IDFC' }],
        bills: [],
        holdings: [{ id: 'sep-i', riId: 'ri1', label: 'Salary', amount: 50000, excluded: true }],
        ...(extra.sep || {}),
      },
    },
  })

  it('leaves the current month\'s holdings untouched (same reference)', () => {
    const store = makeStore()
    const next = syncRecurringToFutureMonths(store, { today })
    expect(next.months['2026-08']).toBe(store.months['2026-08'])
  })

  it('re-derives future-month income holdings from templates, preserving excluded', () => {
    const store = makeStore()
    store.settings.recurringIncomes = [{ id: 'ri1', name: 'Monthly Salary', amount: 60000 }]
    const next = syncRecurringToFutureMonths(store, { today })
    const h = next.months['2026-09'].holdings.find(x => x.riId === 'ri1')
    expect(h).toMatchObject({ id: 'sep-i', label: 'Monthly Salary', amount: 60000, excluded: true })
  })

  it('drops a future income holding when its template is deleted, keeping manual holdings', () => {
    const store = makeStore({ sep: { holdings: [
      { id: 'sep-i', riId: 'ri1', label: 'Salary', amount: 50000, excluded: false },
      { id: 'sep-m', label: 'Monika', amount: 150000 },
    ] } })
    store.settings.recurringIncomes = []
    const next = syncRecurringToFutureMonths(store, { today })
    expect(next.months['2026-09'].holdings.map(h => h.id)).toEqual(['sep-m'])
  })
})

// A small two-month store used by the selective export / merge import tests.
function backupFixture() {
  return {
    activeMonthId: '2026-08',
    months: {
      '2026-08': {
        id: '2026-08',
        holdings: [{ id: 'h1', label: 'Cash', amount: 100 }],
        banks: [{ id: 'b1', name: 'IDFC', actual: 500, primary: true }],
        budget: [{ id: 'bu1', category: 'Food', spend: 0, budget: 200 }],
        bills: [{ id: 'bl1', name: 'Rent', amount: 1000, paid: false }],
        creditCards: [{ id: 'cc1', cardId: 'card1', amount: 50 }],
      },
      '2026-07': {
        id: '2026-07',
        holdings: [{ id: 'h2', label: 'Cash', amount: 80 }],
        banks: [{ id: 'b2', name: 'HDFC', actual: 300, primary: true }],
        budget: [],
        bills: [{ id: 'bl2', name: 'Wifi', amount: 60, paid: true }],
        creditCards: [],
      },
    },
    settings: {
      defaultBankName: 'IDFC',
      creditCards: [{ id: 'card1', name: 'Amex' }],
      spendCategories: [{ id: 'sc1', name: 'Food' }],
      recurringBills: [{ id: 'rb1', day: 1, name: 'Rent', amount: 1000 }],
      recurringIncomes: [{ id: 'ri1', name: 'Salary', amount: 5000 }],
    },
  }
}

describe('selectStore (selective export)', () => {
  it('includes only the chosen months', () => {
    const out = selectStore(backupFixture(), { monthIds: ['2026-08'] })
    expect(Object.keys(out.months)).toEqual(['2026-08'])
    expect(out.months['2026-07']).toBeUndefined()
  })

  it('keeps only the chosen per-month data groups (plus id)', () => {
    const out = selectStore(backupFixture(), { monthIds: ['2026-08'], perMonthKeys: ['bills'] })
    const m = out.months['2026-08']
    expect(Object.keys(m).sort()).toEqual(['bills', 'id'])
    expect(m.bills).toHaveLength(1)
    expect(m.holdings).toBeUndefined()
    expect(m.banks).toBeUndefined()
  })

  it('embeds settings when includeGlobal is true and omits them when false', () => {
    const withGlobal = selectStore(backupFixture(), { monthIds: ['2026-08'], includeGlobal: true })
    expect(withGlobal.settings).toBeDefined()
    expect(withGlobal.settings.creditCards).toHaveLength(1)
    const without = selectStore(backupFixture(), { monthIds: ['2026-08'], includeGlobal: false })
    expect(without.settings).toBeUndefined()
  })

  it('defaults to all months and all keys and includes global', () => {
    const out = selectStore(backupFixture(), {})
    expect(Object.keys(out.months).sort()).toEqual(['2026-07', '2026-08'])
    for (const k of PER_MONTH_KEYS) expect(k in out.months['2026-08']).toBe(true)
    expect(out.settings).toBeDefined()
  })

  it('carries the activeMonthId', () => {
    const out = selectStore(backupFixture(), { monthIds: ['2026-07'] })
    expect(out.activeMonthId).toBe('2026-08')
  })
})

describe('mergeStore (merge import)', () => {
  it('a partial file (one month, one group) upserts without wiping other data', () => {
    const current = backupFixture()
    // A backup carrying ONLY August bills, with an updated row + a new row.
    const partial = {
      months: {
        '2026-08': {
          id: '2026-08',
          bills: [
            { id: 'bl1', name: 'Rent (updated)', amount: 1200, paid: true }, // upsert existing
            { id: 'bl3', name: 'Gym', amount: 40, paid: false }, // new
          ],
        },
      },
    }
    const merged = mergeStore(current, partial)
    const aug = merged.months['2026-08']
    // Bills merged by id: existing updated, new appended.
    expect(aug.bills.find(b => b.id === 'bl1').name).toBe('Rent (updated)')
    expect(aug.bills.find(b => b.id === 'bl3')).toBeDefined()
    expect(aug.bills).toHaveLength(2)
    // Other August groups untouched.
    expect(aug.holdings).toEqual(current.months['2026-08'].holdings)
    expect(aug.banks).toEqual(current.months['2026-08'].banks)
    // July untouched entirely.
    expect(merged.months['2026-07']).toEqual(current.months['2026-07'])
    // Settings untouched (file had none).
    expect(merged.settings).toEqual(current.settings)
  })

  it('adds a month that does not yet exist', () => {
    const current = backupFixture()
    const incoming = {
      months: { '2026-09': { id: '2026-09', bills: [{ id: 'bl9', name: 'New', amount: 10 }] } },
    }
    const merged = mergeStore(current, incoming)
    expect(merged.months['2026-09']).toBeDefined()
    expect(merged.months['2026-09'].bills).toHaveLength(1)
    // Existing months still present.
    expect(Object.keys(merged.months).sort()).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('merges settings lists by id and overwrites defaultBankName only when truthy', () => {
    const current = backupFixture()
    const incoming = {
      settings: {
        creditCards: [
          { id: 'card1', name: 'Amex Platinum' }, // upsert existing
          { id: 'card2', name: 'Visa' }, // new
        ],
        defaultBankName: 'HDFC',
      },
    }
    const merged = mergeStore(current, incoming)
    expect(merged.settings.creditCards.find(c => c.id === 'card1').name).toBe('Amex Platinum')
    expect(merged.settings.creditCards).toHaveLength(2)
    expect(merged.settings.defaultBankName).toBe('HDFC')
    // A list the file omitted stays intact.
    expect(merged.settings.spendCategories).toEqual(current.settings.spendCategories)
  })

  it('does not overwrite defaultBankName with an empty value', () => {
    const current = backupFixture()
    const merged = mergeStore(current, { settings: { defaultBankName: '' } })
    expect(merged.settings.defaultBankName).toBe('IDFC')
  })

  it('a full backup round-trips to an equivalent store', () => {
    const current = backupFixture()
    const full = JSON.parse(JSON.stringify(current)) // a complete export
    const merged = mergeStore(current, full)
    expect(merged.months).toEqual(current.months)
    expect(merged.settings).toEqual(current.settings)
  })

  it('a settings-only file leaves all months intact', () => {
    const current = backupFixture()
    const merged = mergeStore(current, { settings: { spendCategories: [{ id: 'sc2', name: 'Travel' }] } })
    expect(merged.months).toEqual(current.months)
    expect(merged.settings.spendCategories.map(c => c.id).sort()).toEqual(['sc1', 'sc2'])
  })
})
