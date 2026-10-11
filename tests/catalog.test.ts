import { beforeEach, expect, test } from 'bun:test'
import * as c from '../src/server/catalog'
import { type Db, openDb } from '../src/server/db'
import type { ProductInput } from '../src/server/validate'

const BASE = 'https://media.test'
const key = (n: number) => `photo/00000000-0000-4000-8000-00000000000${n}.jpg`
let db: Db
let kitchen: number

const input = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: 'Tumbler',
  categoryId: kitchen,
  price: 'RM 24.90',
  review: 'Nice',
  shopeeUrl: 'https://shopee.com.my/x',
  tiktokUrl: '',
  whatsappUrl: '',
  hidden: false,
  media: [{ type: 'photo', key: key(1) }],
  ...over,
})
const names = () => c.getAdminData(db, BASE).products.map((p) => p.name)

beforeEach(() => {
  db = openDb(':memory:', 'owner@example.com')
  c.addCategory(db, 'Kitchen')
  c.addCategory(db, 'Decor')
  kitchen = c.getAdminData(db, BASE).categories[0].id
})

test('the public page has no hidden product and no buy link', () => {
  c.saveProduct(db, input())
  c.saveProduct(db, input({ name: 'Secret', hidden: true }))
  const page = c.getPublicPage(db, BASE)
  expect(page.categories).toEqual(['Kitchen', 'Decor'])
  expect(page.products).toHaveLength(1)
  expect(page.products[0]).toEqual({
    id: expect.any(Number),
    name: 'Tumbler',
    category: 'Kitchen',
    price: 'RM 24.90',
    review: 'Nice',
    platforms: ['shopee'],
    media: [{ type: 'photo', url: `${BASE}/${key(1)}` }],
  })
  expect(JSON.stringify(page)).not.toContain('shopee.com.my')
})

test('a product with no media has an empty media list', () => {
  c.saveProduct(db, input({ media: [] }))
  expect(c.getPublicPage(db, BASE).products[0].media).toEqual([])
})

test('a new product goes to the top', () => {
  c.saveProduct(db, input({ name: 'A' }))
  c.saveProduct(db, input({ name: 'B' }))
  expect(names()).toEqual(['B', 'A'])
})

test('an edit reports the media keys that were removed', () => {
  const { id } = c.saveProduct(db, input({ media: [{ type: 'photo', key: key(1) }, { type: 'photo', key: key(2) }] }))
  const result = c.saveProduct(db, input({ id, media: [{ type: 'photo', key: key(2) }, { type: 'photo', key: key(3) }] }))
  expect(result.removedKeys).toEqual([key(1)])
  expect(c.getAdminData(db, BASE).products[0].media.map((m) => m.key)).toEqual([key(2), key(3)])
})

test('an edit of a product that is gone is refused', () => {
  expect(() => c.saveProduct(db, input({ id: 999 }))).toThrow(c.UserError)
})

test('a product in an unknown category is refused', () => {
  expect(() => c.saveProduct(db, input({ categoryId: 999 }))).toThrow('Choose a category.')
})

test('delete returns the media keys and removes the product', () => {
  const { id } = c.saveProduct(db, input())
  expect(c.deleteProduct(db, id)).toEqual([key(1)])
  expect(names()).toEqual([])
})

test('move changes the order and stops at each end', () => {
  c.saveProduct(db, input({ name: 'A' }))
  const b = c.saveProduct(db, input({ name: 'B' })).id
  c.moveProduct(db, b, -1)
  expect(names()).toEqual(['B', 'A'])
  c.moveProduct(db, b, 1)
  expect(names()).toEqual(['A', 'B'])
  c.moveProduct(db, b, 1)
  expect(names()).toEqual(['A', 'B'])
})

test('category rules', () => {
  const [k, d] = c.getAdminData(db, BASE).categories
  expect(() => c.addCategory(db, 'kitchen ')).toThrow('That category already exists')
  expect(() => c.addCategory(db, '  ')).toThrow(c.UserError)
  expect(() => c.renameCategory(db, d.id, 'Kitchen')).toThrow('That category already exists')
  expect(() => c.renameCategory(db, d.id, '')).toThrow(c.UserError)
  c.renameCategory(db, d.id, 'Home decor')
  c.saveProduct(db, input())
  expect(() => c.deleteCategory(db, k.id)).toThrow('Move its 1 product to another category first')
  c.deleteCategory(db, d.id)
  expect(c.getAdminData(db, BASE).categories.map((x) => [x.name, x.count])).toEqual([['Kitchen', 1]])
})

test('admin rules', () => {
  expect(c.isAdmin(db, 'OWNER@example.com')).toBe(true)
  expect(c.isAdmin(db, 'other@example.com')).toBe(false)
  c.addAdmin(db, 'second@example.com')
  expect(() => c.addAdmin(db, 'second@example.com')).toThrow('Already has access')
  expect(() => c.removeAdmin(db, 'owner@example.com', 'owner@example.com')).toThrow(c.UserError)
  c.removeAdmin(db, 'second@example.com', 'owner@example.com')
  expect(c.getAdminData(db, BASE).admins).toEqual(['owner@example.com'])
})

test('a click is counted and the link is returned', () => {
  const { id } = c.saveProduct(db, input())
  expect(c.recordClick(db, id, 'shopee')).toBe('https://shopee.com.my/x')
  c.recordClick(db, id, 'shopee')
  expect(c.getAdminData(db, BASE).products[0].clicks).toEqual({ shopee: 2, tiktok: 0, whatsapp: 0 })
})

test('no click is counted for a missing link, a hidden product, or an unknown product', () => {
  const { id } = c.saveProduct(db, input())
  expect(c.recordClick(db, id, 'tiktok')).toBeNull()
  expect(c.recordClick(db, 999, 'shopee')).toBeNull()
  c.setHidden(db, id, true)
  expect(c.recordClick(db, id, 'shopee')).toBeNull()
  expect(c.getAdminData(db, BASE).products[0].clicks.shopee).toBe(0)
})

test('profile save returns the avatar key that was replaced', () => {
  const p = { name: 'Corner', handle: '@corner', bio: 'Hi', whatsapp: '60123456789' }
  expect(c.saveProfile(db, { ...p, avatarKey: 'avatar/a.jpg' })).toBeNull()
  expect(c.saveProfile(db, { ...p, avatarKey: 'avatar/b.jpg' })).toBe('avatar/a.jpg')
  expect(c.saveProfile(db, p)).toBeNull()
  expect(c.getPublicPage(db, BASE).profile.avatarUrl).toBe(`${BASE}/avatar/b.jpg`)
})
