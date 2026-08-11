// Indian-format currency helpers. Kept tiny and dependency-free.

// Group digits in the Indian system (e.g. 1234567 -> "12,34,567").
export function groupIndian(n) {
  const neg = n < 0
  let s = Math.abs(n).toFixed(Math.abs(n) % 1 === 0 ? 0 : 2)
  // Split off decimals first so grouping only touches the integer part.
  let [intPart, decPart] = s.split('.')
  // Indian grouping: last 3 digits, then groups of 2.
  const last3 = intPart.slice(-3)
  const rest = intPart.slice(0, -3)
  const grouped = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
    : last3
  let out = decPart ? `${grouped}.${decPart}` : grouped
  return { text: out, negative: neg }
}

// "₹ 24,233" ; negatives are returned as "(24,233)" without the sign so the
// UI can render them red-in-parentheses like the source spreadsheet.
export function formatINR(n, { withSymbol = true } = {}) {
  const value = Number.isFinite(n) ? n : 0
  const { text, negative } = groupIndian(value)
  const body = negative ? `(${text})` : text
  return withSymbol ? `₹ ${body}` : body
}

// Whether a number should render in the "negative" (red) style.
export function isNegative(n) {
  return Number.isFinite(n) && n < 0
}

// Parse a user-typed value into a number, tolerating commas / ₹ / spaces / blanks.
export function parseNumber(input) {
  if (typeof input === 'number') return input
  if (input == null) return 0
  const cleaned = String(input).replace(/[₹,\s]/g, '').replace(/[()]/g, m => (m === '(' ? '-' : ''))
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}
