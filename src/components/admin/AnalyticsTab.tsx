import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { PLATFORM_LABEL } from '../../lib/platforms'
import { dayLabel, hourLabel, WEEKDAYS } from '../../lib/time'
import type { Analytics } from '../../server/analytics'
import { getAnalyticsFn } from '../../server/fns'
import { type Platform, PLATFORMS, RANGES, type Range } from '../../server/validate'
import type { TabProps } from './Shell'
import { Select } from './Select'

const n = (v: number) => v.toLocaleString('en-MY')
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)
const SECTIONS = ['Overview', 'Visits', 'Taps', 'Products', 'Shops', 'Sources', 'Searches'] as const
type Section = (typeof SECTIONS)[number]
type Filter = { days: Range; from: string | null; to: string | null; categoryId: number | null; productId: number | null; platform: Platform | null }
const DAY = 86_400_000
const mytDate = (offsetDays = 0) => new Date(Date.now() + 8 * 3600_000 + offsetDays * DAY).toISOString().slice(0, 10)

export function AnalyticsTab({ data, flash }: TabProps) {
  const [filter, setFilter] = useState<Filter>({ days: 30, from: null, to: null, categoryId: null, productId: null, platform: null })
  const [section, setSection] = useState<Section>('Overview')
  const [report, setReport] = useState<Analytics | null>(null)
  const set = (patch: Partial<Filter>) => setFilter((f) => ({ ...f, ...patch }))
  const products = data.products.filter((p) => filter.categoryId === null || p.categoryId === filter.categoryId)

  useEffect(() => {
    let current = true
    getAnalyticsFn({ data: filter })
      .then((r) => current && (r.ok ? setReport(r.value) : flash(r.error, true)))
      .catch(() => current && flash('Could not load analytics. Try again.', true))
    return () => {
      current = false
    }
  }, [filter, flash])

  const pick = (value: string) => (value ? Number(value) : null)
  const custom = filter.from !== null && filter.to !== null
  return (
    <>
      <div className="adm-head">
        <div>
          <h2>Analytics</h2>
          <div className="adm-sub">Visits and taps from your page, in Malaysia time.</div>
        </div>
      </div>

      <div className="adm-an-filters">
        <div className="adm-pills-row" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button
              type="button"
              key={r}
              className={r === filter.days && !custom ? 'pill pill-on' : 'pill'}
              onClick={() => set({ days: r, from: null, to: null })}
            >
              {r} days
            </button>
          ))}
          <button
            type="button"
            className={custom ? 'pill pill-on' : 'pill'}
            onClick={() => custom || set({ from: mytDate(-(filter.days - 1)), to: mytDate() })}
          >
            Custom
          </button>
        </div>
        {custom && (
          <div className="adm-an-dates">
            <label>
              <span className="adm-filter-label">From</span>
              <input
                type="date"
                className="adm-input adm-an-date"
                value={filter.from ?? ''}
                max={filter.to ?? mytDate()}
                onChange={(e) => e.target.value && set({ from: e.target.value })}
              />
            </label>
            <label>
              <span className="adm-filter-label">To</span>
              <input
                type="date"
                className="adm-input adm-an-date"
                value={filter.to ?? ''}
                min={filter.from ?? undefined}
                max={mytDate()}
                onChange={(e) => e.target.value && set({ to: e.target.value })}
              />
            </label>
          </div>
        )}
        <Select
          className="adm-an-select"
          aria-label="Category"
          value={String(filter.categoryId ?? '')}
          onChange={(v) => set({ categoryId: pick(v), productId: null })}
          options={[{ value: '', label: 'All categories' }, ...data.categories.map((c) => ({ value: String(c.id), label: c.name }))]}
        />
        <Select
          className="adm-an-select"
          aria-label="Product"
          value={String(filter.productId ?? '')}
          onChange={(v) => set({ productId: pick(v) })}
          options={[{ value: '', label: 'All products' }, ...products.map((p) => ({ value: String(p.id), label: p.name }))]}
        />
        <Select
          className="adm-an-select"
          aria-label="Shop"
          value={filter.platform ?? ''}
          onChange={(v) => set({ platform: (v || null) as Platform | null })}
          options={[{ value: '', label: 'All shops' }, ...PLATFORMS.map((k) => ({ value: k, label: PLATFORM_LABEL[k].chip }))]}
        />
        {(filter.categoryId !== null || filter.productId !== null || filter.platform !== null) && (
          <button type="button" className="link" onClick={() => set({ categoryId: null, productId: null, platform: null })}>
            Clear filters
          </button>
        )}
      </div>

      {!report ? (
        <div className="adm-none">Loading…</div>
      ) : (
        <>
          <Kpis a={report} />
          {report.filtered && (
            <div className="adm-wm-note">Filters apply to product views and buy taps. Visits, searches and chats always count the whole page.</div>
          )}
          <div className="adm-wm-folders" role="tablist" aria-label="Section">
            {SECTIONS.map((s) => (
              <button
                type="button"
                role="tab"
                aria-selected={s === section}
                key={s}
                className={s === section ? 'pill pill-on' : 'pill'}
                onClick={() => setSection(s)}
              >
                {s}
              </button>
            ))}
          </div>
          {section === 'Overview' && <Overview a={report} />}
          {section === 'Visits' && <Visits a={report} />}
          {section === 'Taps' && <Taps a={report} />}
          {section === 'Products' && <Products a={report} />}
          {section === 'Shops' && <Shops a={report} />}
          {section === 'Sources' && <Sources a={report} />}
          {section === 'Searches' && <Searches a={report} />}
        </>
      )}
    </>
  )
}

function Delta({ now, before, days }: { now: number; before: number; days: number }) {
  if (!before) return <span className="adm-stat-delta">{now ? 'New this period' : 'None in the previous period'}</span>
  const change = Math.round(((now - before) / before) * 100)
  return (
    <span className="adm-stat-delta">
      {change > 0 ? '▲' : change < 0 ? '▼' : '='} {Math.abs(change)}% vs previous {days} days
    </span>
  )
}

function Kpis({ a }: { a: Analytics }) {
  const tiles: [string, string, ReactNode][] = [
    ['Visits', n(a.visits.total), <Delta key="v" now={a.visits.total} before={a.visits.previous} days={a.days} />],
    ['Product views', n(a.views.total), <Delta key="p" now={a.views.total} before={a.views.previous} days={a.days} />],
    ['Buy taps', n(a.taps.total), <Delta key="t" now={a.taps.total} before={a.taps.previous} days={a.days} />],
    ['Taps per visit', a.visits.total ? `${pct(a.taps.total, a.visits.total)}%` : '–', <span key="r" className="adm-stat-delta">Buy taps ÷ visits</span>],
    ['WhatsApp chats', n(a.chats.total), <Delta key="c" now={a.chats.total} before={a.chats.previous} days={a.days} />],
  ]
  return (
    <div className="adm-stats">
      {tiles.map(([label, value, delta]) => (
        <div className="adm-stat" key={label}>
          <span className="adm-stat-label">{label}</span>
          <span className="adm-stat-value">{value}</span>
          {delta}
        </div>
      ))}
    </div>
  )
}

const most = (list: number[]) => list.indexOf(Math.max(...list))
const dates = (a: Analytics) =>
  Array.from({ length: a.days }, (_, i) => new Date(Date.parse(`${a.firstDate}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10))

function Overview({ a }: { a: Analytics }) {
  const hour = most(a.taps.byHour)
  const weekday = most(a.taps.byWeekday)
  const [top] = a.products
  const empty = <div className="adm-sub">No taps in this range yet.</div>
  return (
    <>
      <div className="adm-tiles">
        <Tile title="Busiest hour">
          {a.taps.total ? (
            <>
              <span className="adm-tile-value">{hourLabel(hour)}</span>
              <Spark values={a.taps.byHour} peak={hour} />
              <span className="adm-stat-delta">{pct(a.taps.byHour[hour], a.taps.total)}% of taps</span>
            </>
          ) : (
            empty
          )}
        </Tile>
        <Tile title="Busiest day of the week">
          {a.taps.total ? (
            <>
              <span className="adm-tile-value">{WEEKDAYS[weekday]}</span>
              <Spark values={a.taps.byWeekday} peak={weekday} labels={WEEKDAYS.map((d) => d[0])} />
              <span className="adm-stat-delta">{pct(a.taps.byWeekday[weekday], a.taps.total)}% of taps</span>
            </>
          ) : (
            empty
          )}
        </Tile>
        <Tile title="Taps by shop">{a.taps.total ? <Stacked a={a} /> : empty}</Tile>
        <Tile title="From visit to tap">
          <Funnel
            steps={[
              ['Visits', a.visits.total],
              ['Product views', a.views.total],
              ['Buy taps', a.taps.total],
            ]}
          />
        </Tile>
        <Tile title="Top product">
          {top?.taps ? (
            <>
              <span className="adm-tile-name">{top.name}</span>
              <Meter value={pct(top.taps, a.taps.total)} />
              <span className="adm-stat-delta">
                {n(top.taps)} taps, {pct(top.taps, a.taps.total)}% of all
              </span>
            </>
          ) : (
            empty
          )}
        </Tile>
        <Tile title="Searches">
          <span className="adm-tile-value">{n(a.searches.total)}</span>
          <span className="adm-stat-delta">
            {a.searches.noFinds.length
              ? `${a.searches.noFinds.length} found nothing, such as "${a.searches.noFinds[0].term}"`
              : a.searches.total
                ? 'Every search found something'
                : 'No searches yet'}
          </span>
        </Tile>
        <Tile title="Live products with no taps">
          <span className="adm-tile-value">{a.quiet.length}</span>
          {a.quiet.length > 0 && (
            <span className="adm-stat-delta">
              {a.quiet.slice(0, 3).join(', ')}
              {a.quiet.length > 3 ? ` and ${a.quiet.length - 3} more` : ''}
            </span>
          )}
        </Tile>
      </div>
      <Card title="Buy taps by day">
        <Columns items={byDay(a, a.taps.byDay)} label="Buy taps by day" />
      </Card>
    </>
  )
}

const byDay = (a: Analytics, values: number[]) => {
  const every = Math.ceil(values.length / 6)
  return dates(a).map((d, i) => ({ key: d, axis: i % every === 0 ? dayLabel(d).replace(/^\w+, /, '') : '', tip: dayLabel(d), value: values[i] }))
}
const byHour = (values: number[]) =>
  values.map((value, h) => ({ key: String(h), axis: h % 3 === 0 ? hourLabel(h) : '', tip: `${hourLabel(h)} to ${hourLabel((h + 1) % 24)}`, value }))
const byWeekday = (values: number[]) => values.map((value, i) => ({ key: WEEKDAYS[i], axis: WEEKDAYS[i].slice(0, 3), tip: WEEKDAYS[i], value }))

function Visits({ a }: { a: Analytics }) {
  return (
    <>
      <Card title="Visits by day">
        <Columns items={byDay(a, a.visits.byDay)} label="Visits by day" unit="visits" />
        <Table head={['Day', 'Visits']} rows={dates(a).map((d, i) => [dayLabel(d), n(a.visits.byDay[i])])} />
      </Card>
      <div className="adm-card-pair">
        <Card title="Visits by hour of day">
          <Columns items={byHour(a.visits.byHour)} label="Visits by hour of day" unit="visits" />
        </Card>
        <Card title="Visits by day of week">
          <Columns items={byWeekday(a.visits.byWeekday)} label="Visits by day of week" unit="visits" />
        </Card>
      </div>
    </>
  )
}

function Taps({ a }: { a: Analytics }) {
  return (
    <>
      <Card title="Buy taps by day">
        <Columns items={byDay(a, a.taps.byDay)} label="Buy taps by day" />
        <Table head={['Day', 'Taps']} rows={dates(a).map((d, i) => [dayLabel(d), n(a.taps.byDay[i])])} />
      </Card>
      <div className="adm-card-pair">
        <Card title="Buy taps by hour of day">
          <Columns items={byHour(a.taps.byHour)} label="Buy taps by hour of day" />
        </Card>
        <Card title="Buy taps by day of week">
          <Columns items={byWeekday(a.taps.byWeekday)} label="Buy taps by day of week" />
        </Card>
      </div>
    </>
  )
}

function Products({ a }: { a: Analytics }) {
  if (!a.products.length) return <Card title="Products">{<div className="adm-sub">No product was opened or tapped in this range.</div>}</Card>
  const max = Math.max(1, ...a.products.map((p) => Math.max(p.views, p.taps)))
  return (
    <Card title="Products opened and tapped">
      <div className="adm-an-legend">
        <span>
          <i className="adm-key adm-key-views" /> Views
        </span>
        <span>
          <i className="adm-key adm-key-taps" /> Buy taps
        </span>
      </div>
      <div className="adm-an-products">
        {a.products.map((p) => (
          <div className="adm-an-product" key={p.id}>
            <span className="adm-bars-name">{p.name}</span>
            <span className="adm-an-pair">
              <span className="adm-an-bar adm-key-views" style={{ width: `${(p.views / max) * 100}%` }} />
              <span className="adm-an-bar adm-key-taps" style={{ width: `${(p.taps / max) * 100}%` }} />
            </span>
            <span className="adm-bars-value">
              {n(p.views)} views · {n(p.taps)} taps
              {/* Taps recorded before views were tracked can outnumber views. A rate over 100% would mislead, so it is left out. */}
              {p.views >= p.taps && p.views > 0 && <em>{pct(p.taps, p.views)}% tap</em>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Shops({ a }: { a: Analytics }) {
  return (
    <div className="adm-card-pair">
      <Card title="Buy taps by shop">
        <Bars
          total={a.taps.total}
          rows={PLATFORMS.map((k) => ({ key: k, name: PLATFORM_LABEL[k].chip, value: a.byPlatform[k], color: `var(--chart-${k})` }))}
        />
      </Card>
      <Card title="Top buy links">
        <Bars
          total={a.taps.total}
          rows={a.topLinks.map((l) => ({
            key: String(l.id),
            name: [l.name, l.platform && PLATFORM_LABEL[l.platform].chip, l.label].filter(Boolean).join(' · '),
            value: l.taps,
          }))}
        />
      </Card>
    </div>
  )
}

function Sources({ a }: { a: Analytics }) {
  return (
    <div className="adm-card-pair">
      <Card title="Visits by source">
        <Bars
          total={a.visits.total}
          rows={a.sources.filter((s) => s.visits > 0).map((s) => ({ key: s.source, name: s.source, value: s.visits }))}
          empty="No visits in this range."
        />
      </Card>
      <Card title="Buy taps by source">
        <Bars
          total={a.taps.total}
          rows={[...a.sources].sort((x, y) => y.taps - x.taps).filter((s) => s.taps > 0).map((s) => ({ key: s.source, name: s.source, value: s.taps }))}
          empty="No buy taps in this range."
        />
      </Card>
      <p className="adm-sub adm-an-note">
        Add <code>s=threads</code> (or any word) to links you post, e.g. <code>pqacam.com/?p=34&amp;s=threads</code>. Without it, the source comes from the site the visitor came from. Apps often hide that, so those visits show as direct.
      </p>
    </div>
  )
}

function Searches({ a }: { a: Analytics }) {
  return (
    <div className="adm-card-pair">
      <Card title="Most searched">
        <Bars
          total={a.searches.total}
          rows={a.searches.top.map((t) => ({ key: t.term, name: `"${t.term}" · ${t.found} found`, value: t.searches }))}
          empty="No searches in this range."
        />
      </Card>
      <Card title="Searches that found nothing">
        {a.searches.noFinds.length ? (
          <div className="adm-an-terms">
            {a.searches.noFinds.map((t) => (
              <span className="chip chip-warn" key={t.term}>
                {t.term} · {t.searches}
              </span>
            ))}
          </div>
        ) : (
          <div className="adm-sub">None. Every search showed at least one find.</div>
        )}
      </Card>
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="adm-card">
      <h3 className="adm-card-title">{title}</h3>
      {children}
    </section>
  )
}

function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="adm-stat adm-tile-an">
      <span className="adm-stat-label">{title}</span>
      {children}
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <details className="adm-table-toggle">
      <summary>Show as a table</summary>
      <table className="adm-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((cell, i) => (
                <td key={head[i]}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

// A small column chart in a tile. The peak is in ink, the rest in a light step of it, so the busiest slot reads at a glance.
function Spark({ values, peak, labels }: { values: number[]; peak: number; labels?: string[] }) {
  const max = Math.max(1, ...values)
  return (
    <div className="adm-spark" style={{ '--cols': values.length } as CSSProperties} aria-hidden="true">
      {values.map((v, i) => (
        <span key={i} className="adm-spark-col">
          <span className={i === peak ? 'adm-spark-bar adm-spark-peak' : 'adm-spark-bar'} style={{ height: `${(v / max) * 100}%` }} />
          {labels && <span className="adm-spark-label">{labels[i]}</span>}
        </span>
      ))}
    </div>
  )
}

// Shares of taps by shop in one bar, with a legend that names each part.
function Stacked({ a }: { a: Analytics }) {
  const parts = PLATFORMS.filter((k) => a.byPlatform[k] > 0)
  return (
    <>
      <div className="adm-stack">
        {parts.map((k) => (
          <span key={k} style={{ flexGrow: a.byPlatform[k], background: `var(--chart-${k})` }} title={PLATFORM_LABEL[k].chip} />
        ))}
      </div>
      <div className="adm-an-legend">
        {PLATFORMS.map((k) => (
          <span key={k}>
            <i className="adm-key" style={{ background: `var(--chart-${k})` }} /> {PLATFORM_LABEL[k].chip} {pct(a.byPlatform[k], a.taps.total)}%
          </span>
        ))}
      </div>
    </>
  )
}

function Funnel({ steps }: { steps: [string, number][] }) {
  const max = Math.max(1, ...steps.map(([, v]) => v))
  return (
    <div className="adm-funnel">
      {steps.map(([label, value]) => (
        <div className="adm-funnel-row" key={label}>
          <span className="adm-funnel-label">{label}</span>
          <span className="adm-bars-value">{n(value)}</span>
          <span className="adm-funnel-track">
            <span className="adm-funnel-fill" style={{ width: `${(value / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

function Meter({ value }: { value: number }) {
  return (
    <span className="adm-meter" aria-hidden="true">
      <span style={{ width: `${value}%` }} />
    </span>
  )
}

type Column = { key: string; axis: string; tip: string; value: number }

// One series, so no legend: the card title names it. The highest column carries its value, the rest show on hover or focus.
function Columns({ items, label, unit = 'taps' }: { items: Column[]; label: string; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  const peak = items.findIndex((i) => i.value === max)
  return (
    <div className="adm-cols" role="list" aria-label={label} style={{ '--cols': items.length } as CSSProperties}>
      {items.map((item, i) => (
        <div className="adm-col" role="listitem" key={item.key} tabIndex={0} aria-label={`${item.tip}: ${item.value} ${unit}`}>
          <div className="adm-col-plot">
            {i === peak && item.value > 0 && <span className="adm-col-peak">{n(item.value)}</span>}
            <span className="adm-col-bar" style={{ height: `${(item.value / max) * 100}%` }} />
            <span className="adm-col-tip" role="tooltip">
              <strong>{n(item.value)}</strong> {item.tip}
            </span>
          </div>
          <span className="adm-col-axis">{item.axis}</span>
        </div>
      ))}
    </div>
  )
}

type Row = { key: string; name: string; value: number; color?: string }

// Each row names itself, so a color is never the only way to tell rows apart.
function Bars({ rows, total, empty = 'No taps in this range.' }: { rows: Row[]; total: number; empty?: string }) {
  if (!rows.length || total === 0) return <div className="adm-sub">{empty}</div>
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="adm-bars">
      {rows.map((r) => (
        <div className="adm-bars-row" key={r.key}>
          <span className="adm-bars-name">{r.name}</span>
          <span className="adm-bars-track">
            <span className="adm-bars-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </span>
          <span className="adm-bars-value">
            {n(r.value)} <em>{pct(r.value, total)}%</em>
          </span>
        </div>
      ))}
    </div>
  )
}
