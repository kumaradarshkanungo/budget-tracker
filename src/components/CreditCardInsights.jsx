import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { monthlyInsights } from '../lib/calc.js'
import { formatINR } from '../lib/format.js'
import { Computed, Section } from './ui.jsx'

// Fixed palette cycled by group index for chart slices, legend swatches, and bars.
const COLORS = ['#7c5cff', '#2f9e8f', '#e8a13a', '#d64577', '#3a86e8', '#54b06e', '#b0653a', '#9b59b6']
const colorAt = i => COLORS[i % COLORS.length]

// Detailed, read-only insights for the active month's credit-card spends: an
// interactive donut (Recharts) + legend for both the per-card and per-category
// breakdowns, plus labeled bars. All data comes from monthlyInsights
// (src/lib/calc.js) — the same numbers the /credit-cards screen summarised.
export function CreditCardInsights({ month, settings }) {
  const navigate = useNavigate()
  const { total, byCard, byCategory } = monthlyInsights(month, settings)
  const hasData = byCard.groups.length > 0

  return (
    <div className="insights-page">
      <div className="settings-head">
        <h2>Credit Card Insights</h2>
        <button className="mb-btn" onClick={() => navigate('/credit-cards')}>← Back</button>
      </div>

      {!hasData ? (
        <Section title="Insights" accent="#7c5cff">
          <p className="hint section-intro">No spends yet this month.</p>
        </Section>
      ) : (
        <>
          <Breakdown
            title="Card breakdown"
            groups={byCard.groups}
            total={total}
            keyOf={g => g.cardId || '__unknown__'}
          />
          <Breakdown
            title="Category breakdown"
            groups={byCategory.groups}
            total={total}
            keyOf={g => g.categoryId || '__uncat__'}
          />
        </>
      )}
    </div>
  )
}

// One breakdown section: interactive donut + legend (side by side), a total
// row, and labeled bars below. `groups` items expose name/amount/percent/count/deleted.
function Breakdown({ title, groups, total, keyOf }) {
  const [active, setActive] = useState(-1)
  return (
    <Section title={title} accent="#7c5cff">
      <div className="insights-grid">
        <DonutChart groups={groups} active={active} setActive={setActive} label={title} />
        <ul className="legend">
          {groups.map((g, i) => (
            <li
              className={`legend-item ${active === i ? 'is-active' : ''}`}
              key={keyOf(g)}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(-1)}
            >
              <span className="legend-swatch" style={{ background: colorAt(i) }} />
              <span className={`legend-name ${g.deleted ? 'muted' : ''}`}>{g.name}</span>
              <span className="legend-val">
                <Computed value={g.amount} />
                <span className="legend-pct">{Math.round(g.percent)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="row total-row insight-total">
        <span>Total</span>
        <span className="insight-amount">
          <Computed value={total} strong />
          <span className="insight-pct" aria-hidden="true" />
        </span>
      </div>
      <BarList groups={groups} keyOf={keyOf} active={active} setActive={setActive} />
    </Section>
  )
}

// Interactive Recharts donut. Hovering a slice (or a synced legend/bar row via
// `active`) pops it out and shows a tooltip; the centre reads the active slice's
// share, or the slice count when nothing is hovered.
function DonutChart({ groups, active, setActive, label }) {
  const activeGroup = active >= 0 ? groups[active] : null
  return (
    <div className="donut-chart" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={groups}
            dataKey="amount"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={82}
            paddingAngle={groups.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
            activeIndex={active >= 0 ? active : undefined}
            activeShape={renderActiveShape}
            onMouseEnter={(_, i) => setActive(i)}
            onMouseLeave={() => setActive(-1)}
          >
            {groups.map((g, i) => (
              <Cell key={i} fill={colorAt(i)} opacity={active === -1 || active === i ? 1 : 0.35} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center-overlay">
        {activeGroup ? (
          <>
            <span className="donut-center-pct">{Math.round(activeGroup.percent)}%</span>
            <span className="donut-center-cap">{activeGroup.name}</span>
          </>
        ) : (
          <>
            <span className="donut-center-pct">{groups.length}</span>
            <span className="donut-center-cap">{groups.length === 1 ? 'group' : 'groups'}</span>
          </>
        )}
      </div>
    </div>
  )
}

// Slightly enlarged sector for the hovered/active slice.
function renderActiveShape(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  )
}

// Custom tooltip: name + INR amount (Recharts default formatting is generic).
function DonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0]
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-name">{p.name}</span>
      <span className="chart-tooltip-val">{formatINR(p.value)}</span>
    </div>
  )
}

// Labeled horizontal bars reusing the .share-bar visual language; rows sync with
// the donut's active slice via `active`/`setActive`.
function BarList({ groups, keyOf, active, setActive }) {
  return (
    <div className="rows insight-bars">
      {groups.map((g, i) => (
        <div
          className={`insight-row ${active === i ? 'is-active' : ''}`}
          key={keyOf(g)}
          onMouseEnter={() => setActive(i)}
          onMouseLeave={() => setActive(-1)}
        >
          <div className="row two">
            <span className={`insight-name ${g.deleted ? 'muted' : ''}`}>
              {g.name}
              <span className="count-badge">{g.count}</span>
            </span>
            <span className="insight-amount">
              <Computed value={g.amount} />
              <span className="insight-pct">{Math.round(g.percent)}%</span>
            </span>
          </div>
          <div className="share-bar">
            <span style={{ width: `${Math.min(100, Math.max(0, g.percent))}%`, background: colorAt(i) }} />
          </div>
        </div>
      ))}
    </div>
  )
}
