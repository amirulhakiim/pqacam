import { type CSSProperties, useEffect, useState } from 'react'
import { dayLabel, hourLabel, insights, WEEKDAYS } from '../../lib/insights'
import { PLATFORM_LABEL } from '../../lib/platforms'
import type { Analytics } from '../../server/analytics'
import { getAnalyticsFn } from '../../server/fns'
import { PLATFORMS, RANGES, type Range } from '../../server/validate'
import type { TabProps } from './Shell'

const n = (v: number) => v.toLocaleString('en-MY')

export function AnalyticsTab({ flash }: TabProps) {
  const [range, setRange] = useState<Range>(30)
  const [data, setData] = useState<Analytics | null>(null)

  useEffect(() => {
    let current = true
    getAnalyticsFn({ data: range })
      .then((r) => current && (r.ok ? setData(r.value) : flash(r.error)))
      .catch(() => current && flash('Could not load analytics. Try again.'))
    return () => {
      current = false
    }
  }, [range, flash])

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>Analytics</h2>
          <div className="adm-sub">Taps on buy buttons, in Malaysia time.</div>
        </div>
        <div className="adm-head-actions" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button type="button" key={r} className={r === range ? 'pill pill-on' : 'pill'} onClick={() => setRange(r)}>
              {r} days
            </button>
          ))}
        </div>
      </div>
      {!data ? <div className="adm-none">Loading…</div> : <Report a={data} />}
    </>
  )
}

function Report({ a }: { a: Analytics }) {
  const change = a.previous ? Math.round(((a.total - a.previous) / a.previous) * 100) : null
  const hours = a.byHour.map((taps, h) => ({ key: String(h), axis: h % 3 === 0 ? hourLabel(h) : '', tip: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, taps }))
  // Label about six dates across the range, so they never collide.
  const every = Math.ceil(a.byDay.length / 6)
  const days = a.byDay.map((d, i) => ({ key: d.date, axis: i % every === 0 ? dayLabel(d.date).replace(/^\w+, /, '') : '', tip: dayLabel(d.date), taps: d.taps }))
  const weekdays = a.byWeekday.map((taps, i) => ({ key: WEEKDAYS[i], axis: WEEKDAYS[i].slice(0, 3), tip: WEEKDAYS[i], taps }))

  return (
    <>
      <div className="adm-stats">
        <div className="adm-stat">
          <span className="adm-stat-label">Taps, last {a.days} days</span>
          <span className="adm-stat-value">{n(a.total)}</span>
          <span className="adm-stat-delta">
            {change === null ? 'No earlier taps to compare' : `${change > 0 ? '+' : ''}${change}% on the previous ${a.days} days`}
          </span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-label">Daily average</span>
          <span className="adm-stat-value">{(a.total / a.days).toLocaleString('en-MY', { maximumFractionDigits: 1 })}</span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-label">All-time taps</span>
          <span className="adm-stat-value">{n(a.allTime)}</span>
          <span className="adm-stat-delta">Since the site started</span>
        </div>
      </div>

      <section className="adm-card">
        <h3 className="adm-card-title">Insights</h3>
        <ul className="adm-insights">
          {insights(a).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="adm-card">
        <h3 className="adm-card-title">Taps by day</h3>
        <Columns items={days} label="Taps by day" />
        <details className="adm-table-toggle">
          <summary>Show as a table</summary>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Taps</th>
              </tr>
            </thead>
            <tbody>
              {a.byDay.map((d) => (
                <tr key={d.date}>
                  <td>{dayLabel(d.date)}</td>
                  <td>{n(d.taps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="adm-card-pair">
        <section className="adm-card">
          <h3 className="adm-card-title">Taps by hour of day</h3>
          <Columns items={hours} label="Taps by hour of day" />
        </section>
        <section className="adm-card">
          <h3 className="adm-card-title">Taps by day of week</h3>
          <Columns items={weekdays} label="Taps by day of week" />
        </section>
      </div>

      <div className="adm-card-pair">
        <section className="adm-card">
          <h3 className="adm-card-title">By shop</h3>
          <Bars
            total={a.total}
            rows={PLATFORMS.map((k) => ({ key: k, name: PLATFORM_LABEL[k].chip, taps: a.byPlatform[k], color: `var(--chart-${k})` }))}
          />
        </section>
        <section className="adm-card">
          <h3 className="adm-card-title">Top products</h3>
          <Bars total={a.total} rows={a.topProducts.map((p) => ({ key: String(p.id), name: p.name, taps: p.taps }))} />
        </section>
      </div>

      <section className="adm-card">
        <h3 className="adm-card-title">Top buy links</h3>
        <Bars
          total={a.total}
          rows={a.topLinks.map((l) => ({
            key: String(l.id),
            name: [l.name, l.platform && PLATFORM_LABEL[l.platform].chip, l.label].filter(Boolean).join(' · '),
            taps: l.taps,
          }))}
        />
      </section>
    </>
  )
}

type Column = { key: string; axis: string; tip: string; taps: number }

// One series, so no legend: the card title names it. The highest column carries its value, the rest show on hover or focus.
function Columns({ items, label }: { items: Column[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.taps))
  const peak = items.findIndex((i) => i.taps === max)
  return (
    <div className="adm-cols" role="list" aria-label={label} style={{ '--cols': items.length } as CSSProperties}>
      {items.map((item, i) => (
        <div className="adm-col" role="listitem" key={item.key} tabIndex={0} aria-label={`${item.tip}: ${item.taps} taps`}>
          <div className="adm-col-plot">
            {i === peak && item.taps > 0 && <span className="adm-col-peak">{n(item.taps)}</span>}
            <span className="adm-col-bar" style={{ height: `${(item.taps / max) * 100}%` }} />
            <span className="adm-col-tip" role="tooltip">
              <strong>{n(item.taps)}</strong> {item.tip}
            </span>
          </div>
          <span className="adm-col-axis">{item.axis}</span>
        </div>
      ))}
    </div>
  )
}

type Row = { key: string; name: string; taps: number; color?: string }

// Each row names itself, so a color is never the only way to tell rows apart.
function Bars({ rows, total }: { rows: Row[]; total: number }) {
  if (!rows.length || total === 0) return <div className="adm-sub">No taps in this range.</div>
  const max = Math.max(1, ...rows.map((r) => r.taps))
  return (
    <div className="adm-bars">
      {rows.map((r) => (
        <div className="adm-bars-row" key={r.key}>
          <span className="adm-bars-name">{r.name}</span>
          <span className="adm-bars-track">
            <span className="adm-bars-fill" style={{ width: `${(r.taps / max) * 100}%`, background: r.color }} />
          </span>
          <span className="adm-bars-value">
            {n(r.taps)} <em>{Math.round((r.taps / total) * 100)}%</em>
          </span>
        </div>
      ))}
    </div>
  )
}
