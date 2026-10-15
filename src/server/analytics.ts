import { and, gte, lt } from 'drizzle-orm'
import type { Db } from './db'
import { click, link, product } from './schema'
import { PLATFORMS, type Range } from './validate'

// ponytail: Malaysia time, fixed UTC+8 (Malaysia has no daylight saving). Make it a setting if the shop moves.
const TZ_OFFSET = 8 * 3600_000
const DAY = 86_400_000

const localDay = (at: number) => Math.floor((at + TZ_OFFSET) / DAY)
const isoDate = (day: number) => new Date(day * DAY).toISOString().slice(0, 10)

export function getAnalytics(db: Db, days: Range, now = Date.now()) {
  const today = localDay(now)
  // The range is whole local days, today included. The previous period is the same length just before it.
  const start = (today - days + 1) * DAY - TZ_OFFSET
  const prevStart = start - days * DAY
  const rows = db.select().from(click).where(gte(click.at, start)).all()
  const previous = db
    .select({ at: click.at })
    .from(click)
    .where(and(gte(click.at, prevStart), lt(click.at, start)))
    .all().length

  const byDay = Array.from({ length: days }, (_, i) => ({ date: isoDate(today - days + 1 + i), taps: 0 }))
  const byHour = Array<number>(24).fill(0)
  // Monday first. 1970-01-01, local day 0, was a Thursday.
  const byWeekday = Array<number>(7).fill(0)
  const byPlatform = Object.fromEntries(PLATFORMS.map((k) => [k, 0])) as Record<(typeof PLATFORMS)[number], number>
  const byProduct = new Map<number, number>()
  const byLink = new Map<number, number>()
  for (const r of rows) {
    const day = localDay(r.at)
    byDay[day - (today - days + 1)].taps++
    byHour[Math.floor(((r.at + TZ_OFFSET) % DAY) / 3600_000)]++
    byWeekday[(day + 3) % 7]++
    byPlatform[r.platform]++
    byProduct.set(r.productId, (byProduct.get(r.productId) ?? 0) + 1)
    byLink.set(r.linkId, (byLink.get(r.linkId) ?? 0) + 1)
  }

  const products = db.select({ id: product.id, name: product.name, hidden: product.hidden }).from(product).all()
  const links = db.select().from(link).all()
  const productName = (id: number) => products.find((p) => p.id === id)?.name ?? 'Deleted product'
  const top = <T>(map: Map<number, number>, describe: (id: number) => T) =>
    [...map].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, taps]) => ({ id, taps, ...describe(id) }))

  return {
    days,
    total: rows.length,
    previous,
    allTime: links.reduce((n, l) => n + l.clicks, 0),
    byDay,
    byHour,
    byWeekday,
    byPlatform,
    topProducts: top(byProduct, (id) => ({ name: productName(id) })),
    topLinks: top(byLink, (id) => {
      const l = links.find((x) => x.id === id)
      return { name: l ? productName(l.productId) : 'Deleted link', platform: l?.platform ?? null, label: l?.label ?? '' }
    }),
    // Live products that no one tapped in this range.
    quiet: products.filter((p) => !p.hidden && !byProduct.has(p.id)).map((p) => p.name),
  }
}
export type Analytics = ReturnType<typeof getAnalytics>
