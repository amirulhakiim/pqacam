import { expect, test } from 'bun:test'
import { getAnalytics, toRange } from '../src/server/analytics'
import * as c from '../src/server/catalog'
import { openDb } from '../src/server/db'

// Malaysia is UTC+8. 2026-10-15 is a Thursday.
const myt = (iso: string) => Date.parse(`${iso}+08:00`)
const NOW = myt('2026-10-15T12:00:00')

function setup() {
  const db = openDb(':memory:')
  c.addCategory(db, 'Kitchen')
  const categoryId = c.getAdminData(db, '').categories[0].id
  const base = { categoryId, price: '', review: '', hidden: false, media: [] }
  c.saveProduct(db, {
    ...base,
    name: 'Tumbler',
    links: [
      { platform: 'shopee', label: 'Set of 2', url: 'https://shopee.com.my/2' },
      { platform: 'shopee', label: 'Set of 4', url: 'https://shopee.com.my/4' },
      { platform: 'tiktok', label: '', url: 'https://www.tiktok.com/t' },
    ],
  })
  c.saveProduct(db, { ...base, name: 'Vase', links: [{ platform: 'whatsapp', label: '', url: 'https://wa.me/1' }] })
  const [vase, tumbler] = c.getAdminData(db, '').products
  return { db, tumbler, vase }
}

test('taps are grouped by Malaysia day, hour and weekday, with the previous period', () => {
  const { db, tumbler } = setup()
  const [two, four, tiktok] = tumbler.links.map((l) => l.id!)
  c.recordClick(db, two, myt('2026-10-15T00:30:00')) // today, 12 am, just after local midnight
  c.recordClick(db, two, myt('2026-10-14T21:10:00'))
  c.recordClick(db, four, myt('2026-10-14T21:50:00'))
  c.recordClick(db, tiktok, myt('2026-10-09T09:00:00')) // first day of a 7-day range
  c.recordClick(db, tiktok, myt('2026-10-08T23:59:00')) // the day before: previous period
  const a = getAnalytics(db, 7, NOW)
  expect(a.total).toBe(4)
  expect(a.previous).toBe(1)
  expect(a.allTime).toBe(5)
  expect(a.byDay.map((d) => d.date)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'])
  expect(a.byDay.map((d) => d.taps)).toEqual([1, 0, 0, 0, 0, 2, 1])
  expect(a.byHour[0]).toBe(1)
  expect(a.byHour[21]).toBe(2)
  expect(a.byHour[9]).toBe(1)
  // Monday first: Fri 9th, Wed 14th, Thu 15th.
  expect(a.byWeekday).toEqual([0, 0, 2, 1, 1, 0, 0])
  expect(a.byPlatform).toEqual({ shopee: 3, tiktok: 1, whatsapp: 0 })
  expect(a.topProducts).toEqual([{ id: tumbler.id, name: 'Tumbler', taps: 4 }])
  expect(a.topLinks[0]).toMatchObject({ id: two, label: 'Set of 2', taps: 2 })
  expect(a.quiet).toEqual(['Vase'])
})

test('a deleted link keeps its taps in the history', () => {
  const { db, tumbler } = setup()
  const four = tumbler.links[1].id!
  c.recordClick(db, four, NOW)
  c.saveProduct(db, { ...tumbler, links: [tumbler.links[0]] })
  const a = getAnalytics(db, 30, NOW)
  expect(a.total).toBe(1)
  expect(a.topLinks[0]).toMatchObject({ name: 'Deleted link', platform: null, taps: 1 })
})

test('an unknown range falls back to 30 days', () => {
  expect(toRange(7)).toBe(7)
  expect(toRange(365)).toBe(30)
  expect(toRange('7')).toBe(30)
})
