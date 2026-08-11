import { summary, dateTracker } from '../lib/calc.js'
import { Computed } from './ui.jsx'

// Summary cards (Total Available / Total Spend / Extra) + the date tracker.
// Start/End dates are derived from the month (first/last day) and are read-only.
export function SummaryCards({ month }) {
  const { available, spend, extra } = summary(month)
  const { daysPassed, daysLeft, startDate, endDate } = dateTracker(month)

  const fmtDate = iso => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }

  return (
    <div className="summary-wrap">
      <div className="summary-cards">
        <div className="scard">
          <span className="scard-label">Total Available</span>
          <Computed value={available} strong />
        </div>
        <div className="scard">
          <span className="scard-label">Total Spend</span>
          <Computed value={spend} strong />
        </div>
        <div className="scard">
          <span className="scard-label">Extra</span>
          <Computed value={extra} strong />
        </div>
      </div>

      <div className="date-card">
        <div className="date-field ro">
          <span className="scard-label">Start Date</span>
          <strong>{fmtDate(startDate)}</strong>
        </div>
        <div className="date-field ro">
          <span className="scard-label">End Date</span>
          <strong>{fmtDate(endDate)}</strong>
        </div>
        <div className="date-field ro">
          <span className="scard-label">Days Left</span>
          <strong>{daysLeft} days</strong>
        </div>
        <div className="date-field ro">
          <span className="scard-label">Days Passed</span>
          <strong>{daysPassed} days</strong>
        </div>
      </div>
    </div>
  )
}
