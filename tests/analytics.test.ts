import { expect, test } from 'bun:test'
import { type AnalyticsFilter, getAnalytics, recordEvent } from '../src/server/analytics'
import * as c from '../src/server/catalog'
import { openDb } from '../src/server/db'
import { event } from '../src/server/schema'
import { toRange } from '../src/server/validate'

// Malaysia is UTC+8. 2026-10-15 is a Thursday.
const myt = (iso: string) => Date.parse(`${iso}+08:00`)
const NOW = myt('2026-10-15T12:00:00')
const all: AnalyticsFilter = { days: 7, categoryId: null, productId: null, platform: null }

function setup() {
  const db = openDb(':memory:')
  c.addCategory(db, 'Kitchen')
  c.addCategory(db, 'Decor')
  const [kitchen, decor] = c.getAdminData(db, '').categories
  const base = { price: '', review: '', hidden: false, media: [] }
  c.saveProduct(db, {
    ...base,
    categoryId: kitchen.id,
    name: 'Tumbler',
    links: [
      { platform: 'shopee', label: 'Set of 2', url: 'https://shopee.com.my/2' },
      { platform: 'shopee', label: 'Set of 4', url: 'https://shopee.com.my/4' },
      { platform: 'tiktok', label: '', url: 'https://www.tiktok.com/t' },
    ],
  })
  c.saveProduct(db, { ...base, categoryId: decor.id, name: 'Vase', links: [{ platform: 'whatsapp', label: '', url: 'https://wa.me/1' }] })
  const [vase, tumbler] = c.getAdminData(db, '').products
  return { db, tumbler, vase, kitchen, decor }
}

test('taps are grouped by Malaysia day, hour and weekday, with the previous period', () => {
  const { db, tumbler } = setup()
  const [two, four, tiktok] = tumbler.links.map((l) => l.id!)
  c.recordClick(db, two, myt('2026-10-15T00:30:00')) // today, 12 am, just after local midnight
  c.recordClick(db, two, myt('2026-10-14T21:10:00'))
  c.recordClick(db, four, myt('2026-10-14T21:50:00'))
  c.recordClick(db, tiktok, myt('2026-10-09T09:00:00')) // first day of a 7-day range
  c.recordClick(db, tiktok, myt('2026-10-08T23:59:00')) // the day before: previous period
  const a = getAnalytics(db, all, NOW)
  expect(a.firstDate).toBe('2026-10-09')
  expect(a.taps.total).toBe(4)
  expect(a.taps.previous).toBe(1)
  expect(a.allTimeTaps).toBe(5)
  expect(a.taps.byDay).toEqual([1, 0, 0, 0, 0, 2, 1])
  expect([a.taps.byHour[0], a.taps.byHour[9], a.taps.byHour[21]]).toEqual([1, 1, 2])
  // Monday first: Fri 9th, Wed 14th, Thu 15th.
  expect(a.taps.byWeekday).toEqual([0, 0, 2, 1, 1, 0, 0])
  expect(a.byPlatform).toEqual({ shopee: 3, tiktok: 1, whatsapp: 0 })
  expect(a.topLinks[0]).toMatchObject({ id: two, label: 'Set of 2', taps: 2 })
  expect(a.quiet).toEqual(['Vase'])
})

test('filters by category, product and shop limit taps and views, not visits', () => {
  const { db, tumbler, vase, decor } = setup()
  c.recordClick(db, tumbler.links[0].id!, NOW)
  c.recordClick(db, tumbler.links[2].id!, NOW)
  c.recordClick(db, vase.links[0].id!, NOW)
  recordEvent(db, { type: 'view', productId: tumbler.id }, NOW)
  recordEvent(db, { type: 'view', productId: vase.id }, NOW)
  recordEvent(db, { type: 'visit' }, NOW)
  const byCategory = getAnalytics(db, { ...all, categoryId: decor.id }, NOW)
  expect([byCategory.taps.total, byCategory.views.total, byCategory.visits.total, byCategory.filtered]).toEqual([1, 1, 1, true])
  expect(byCategory.products).toEqual([{ id: vase.id, name: 'Vase', views: 1, taps: 1 }])
  const byShop = getAnalytics(db, { ...all, platform: 'tiktok' }, NOW)
  expect([byShop.taps.total, byShop.views.total]).toEqual([1, 2])
  const byProduct = getAnalytics(db, { ...all, productId: tumbler.id }, NOW)
  expect(byProduct.products).toEqual([{ id: tumbler.id, name: 'Tumbler', views: 1, taps: 2 }])
  expect(byProduct.allTimeTaps).toBe(2)
})

test('searches are counted by term, with the ones that found nothing', () => {
  const { db } = setup()
  recordEvent(db, { type: 'search', term: 'Tumbler', results: 1 }, NOW)
  recordEvent(db, { type: 'search', term: 'tumbler ', results: 1 }, NOW)
  recordEvent(db, { type: 'search', term: 'rice cooker', results: 0 }, NOW)
  recordEvent(db, { type: 'chat' }, NOW)
  const a = getAnalytics(db, all, NOW)
  expect(a.searches.total).toBe(3)
  expect(a.searches.top).toEqual([
    { term: 'tumbler', searches: 2, found: 1 },
    { term: 'rice cooker', searches: 1, found: 0 },
  ])
  expect(a.searches.noFinds.map((t) => t.term)).toEqual(['rice cooker'])
  expect(a.chats.total).toBe(1)
})

test('a deleted link keeps its taps in the history', () => {
  const { db, tumbler } = setup()
  c.recordClick(db, tumbler.links[1].id!, NOW)
  c.saveProduct(db, { ...tumbler, links: [tumbler.links[0]] })
  const a = getAnalytics(db, { ...all, days: 30 }, NOW)
  expect(a.taps.total).toBe(1)
  expect(a.topLinks[0]).toMatchObject({ name: 'Deleted link', platform: null, taps: 1 })
})

test('an unknown range falls back to 30 days', () => {
  expect(toRange(7)).toBe(7)
  expect(toRange(365)).toBe(30)
  expect(toRange('7')).toBe(30)
})

test('events from visitors are checked before they are stored', () => {
  const { db, tumbler } = setup()
  expect(recordEvent(db, { type: 'visit' }, NOW)).toBe(true)
  expect(recordEvent(db, { type: 'chat' }, NOW)).toBe(true)
  expect(recordEvent(db, { type: 'view', productId: tumbler.id }, NOW)).toBe(true)
  expect(recordEvent(db, { type: 'view', productId: 999 }, NOW)).toBe(false)
  expect(recordEvent(db, { type: 'search', term: '  Glass   TUMBLER ', results: 1 }, NOW)).toBe(true)
  expect(recordEvent(db, { type: 'search', term: 'a', results: 0 }, NOW)).toBe(false)
  expect(recordEvent(db, { type: 'drop table' }, NOW)).toBe(false)
  expect(recordEvent(db, null, NOW)).toBe(false)
  c.setHidden(db, tumbler.id, true)
  expect(recordEvent(db, { type: 'view', productId: tumbler.id }, NOW)).toBe(false)
  expect(db.select().from(event).all().map((r) => [r.type, r.term])).toEqual([
    ['visit', null],
    ['chat', null],
    ['view', null],
    ['search', 'glass tumbler'],
  ])
})
