import { and, eq, gte, lt } from 'drizzle-orm'
import { cleanSource, sourceLabel } from '../lib/source'
import type { Db } from './db'
import { click, event, link, product } from './schema'
import { type Platform, PLATFORMS, type Range } from './validate'

// ponytail: Malaysia time, fixed UTC+8 (Malaysia has no daylight saving). Make it a setting if the shop moves.
const TZ_OFFSET = 8 * 3600_000
const DAY = 86_400_000

const localDay = (at: number) => Math.floor((at + TZ_OFFSET) / DAY)
const isoDate = (day: number) => new Date(day * DAY).toISOString().slice(0, 10)

export type AnalyticsFilter = {
  days: Range
  from?: string | null
  to?: string | null
  categoryId: number | null
  productId: number | null
  platform: Platform | null
}

const MAX_DAYS = 366
const isoDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY)

function dayRange(f: AnalyticsFilter, today: number) {
  if (!f.from || !f.to) return { firstDay: today - f.days + 1, lastDay: today }
  let [firstDay, lastDay] = [isoDay(f.from), isoDay(f.to)].sort((x, y) => x - y)
  lastDay = Math.min(lastDay, today)
  firstDay = Math.max(Math.min(firstDay, lastDay), lastDay - MAX_DAYS + 1)
  return { firstDay, lastDay }
}

type Timed = { at: number }

// Buckets in local time: one per day of the range, per hour of the day, and per weekday (Monday first).
function series(rows: Timed[], firstDay: number, days: number) {
  const byDay = Array<number>(days).fill(0)
  const byHour = Array<number>(24).fill(0)
  const byWeekday = Array<number>(7).fill(0)
  for (const r of rows) {
    const day = localDay(r.at)
    byDay[day - firstDay]++
    byHour[Math.floor(((r.at + TZ_OFFSET) % DAY) / 3600_000)]++
    // 1970-01-01, local day 0, was a Thursday.
    byWeekday[(day + 3) % 7]++
  }
  return { total: rows.length, byDay, byHour, byWeekday }
}

const count = <K>(keys: K[]) => {
  const map = new Map<K, number>()
  for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1)
  return map
}

export function getAnalytics(db: Db, f: AnalyticsFilter, now = Date.now()) {
  const { firstDay, lastDay } = dayRange(f, localDay(now))
  const days = lastDay - firstDay + 1
  // The range is whole local days. The previous period is the same length just before it.
  const start = firstDay * DAY - TZ_OFFSET
  const end = (lastDay + 1) * DAY - TZ_OFFSET
  const prevStart = start - days * DAY
  const products = db.select({ id: product.id, name: product.name, hidden: product.hidden, categoryId: product.categoryId }).from(product).all()
  const links = db.select().from(link).all()
  // A category or product filter limits taps and views to these products. Deleted products drop out of a category filter.
  const inScope = (productId: number | null) =>
    (f.productId === null || productId === f.productId) &&
    (f.categoryId === null || products.some((p) => p.id === productId && p.categoryId === f.categoryId))
  const tapOk = (r: { productId: number; platform: Platform }) => inScope(r.productId) && (f.platform === null || r.platform === f.platform)

  const clicks = db.select().from(click).where(and(gte(click.at, prevStart), lt(click.at, end))).all().filter(tapOk)
  const events = db.select().from(event).where(and(gte(event.at, prevStart), lt(event.at, end))).all()
  const now_ = (r: Timed) => r.at >= start
  const before = (r: Timed) => r.at < start
  const taps = clicks.filter(now_)
  const views = events.filter((e) => e.type === 'view' && inScope(e.productId))
  const visits = events.filter((e) => e.type === 'visit')
  const chats = events.filter((e) => e.type === 'chat')
  const searches = events.filter((e) => e.type === 'search' && now_(e))

  const productName = (id: number) => products.find((p) => p.id === id)?.name ?? 'Deleted product'
  const tapsBy = count(taps.map((t) => t.productId))
  const viewsBy = count(views.filter(now_).map((v) => v.productId!))
  const linkTaps = count(taps.map((t) => t.linkId))
  const termCount = count(searches.map((s) => s.term!))
  const lastResults = new Map(searches.map((s) => [s.term!, s.results ?? 0]))
  const visitsNow = visits.filter(now_)
  const visitsBySource = count(visitsNow.map((v) => sourceLabel(v.source)))
  const tapsBySource = count(taps.map((t) => sourceLabel(t.source)))
  const terms = [...termCount].sort((a, b) => b[1] - a[1]).map(([term, n]) => ({ term, searches: n, found: lastResults.get(term) ?? 0 }))

  return {
    days,
    firstDate: isoDate(firstDay),
    lastDate: isoDate(lastDay),
    filtered: f.categoryId !== null || f.productId !== null || f.platform !== null,
    taps: { ...series(taps, firstDay, days), previous: clicks.filter(before).length },
    views: { total: views.filter(now_).length, previous: views.filter(before).length },
    visits: { ...series(visits.filter(now_), firstDay, days), previous: visits.filter(before).length },
    chats: { total: chats.filter(now_).length, previous: chats.filter(before).length },
    allTimeTaps: links.filter((l) => inScope(l.productId) && (f.platform === null || l.platform === f.platform)).reduce((n, l) => n + l.clicks, 0),
    sources: [...new Set([...visitsBySource.keys(), ...tapsBySource.keys()])]
      .map((source) => ({ source, visits: visitsBySource.get(source) ?? 0, taps: tapsBySource.get(source) ?? 0 }))
      .sort((x, y) => y.taps - x.taps || y.visits - x.visits),
    byPlatform: Object.fromEntries(PLATFORMS.map((k) => [k, taps.filter((t) => t.platform === k).length])) as Record<Platform, number>,
    // Every product with a view or a tap, most taps first.
    products: [...new Set([...tapsBy.keys(), ...viewsBy.keys()])]
      .map((id) => ({ id, name: productName(id), views: viewsBy.get(id) ?? 0, taps: tapsBy.get(id) ?? 0 }))
      .sort((a, b) => b.taps - a.taps || b.views - a.views),
    topLinks: [...linkTaps]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => {
        const l = links.find((x) => x.id === id)
        return { id, taps: n, name: l ? productName(l.productId) : 'Deleted link', platform: l?.platform ?? null, label: l?.label ?? '' }
      }),
    searches: { total: searches.length, top: terms.slice(0, 8), noFinds: terms.filter((t) => t.found === 0).slice(0, 8) },
    // Live products in scope that no one tapped in this range.
    quiet: products.filter((p) => !p.hidden && inScope(p.id) && !tapsBy.has(p.id)).map((p) => p.name),
  }
}
export type Analytics = ReturnType<typeof getAnalytics>

export const EVENT_TYPES = ['visit', 'view', 'search', 'chat'] as const

// Input from any visitor, so every field is checked. A view must name a live product. A search keeps at most 60 characters.
// ponytail: no rate limit, so a script could inflate the counts. Add one per IP if the numbers start to look wrong.
export function recordEvent(db: Db, raw: unknown, at = Date.now()): boolean {
  const r = (raw ?? {}) as Record<string, unknown>
  const type = EVENT_TYPES.find((t) => t === r.type)
  if (!type) return false
  const source = cleanSource(r.source)
  if (type === 'view') {
    const id = Number.isInteger(r.productId) ? (r.productId as number) : -1
    const row = db.select({ hidden: product.hidden }).from(product).where(eq(product.id, id)).get()
    if (!row || row.hidden) return false
    db.insert(event).values({ type, productId: id, source, at }).run()
    return true
  }
  if (type === 'search') {
    const term = typeof r.term === 'string' ? r.term.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60) : ''
    const results = Number.isInteger(r.results) ? Math.max(0, Math.min(10_000, r.results as number)) : 0
    if (term.length < 2) return false
    db.insert(event).values({ type, term, results, source, at }).run()
    return true
  }
  db.insert(event).values({ type, source, at }).run()
  return true
}
