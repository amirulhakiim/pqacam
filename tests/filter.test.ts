import { expect, test } from 'bun:test'
import { filterProducts, wrap } from '../src/lib/filter'
import type { PublicProduct } from '../src/server/catalog'

const product = (over: Partial<PublicProduct>): PublicProduct => ({
  id: 1,
  name: 'Glass Tumbler',
  shortName: '',
  category: 'Kitchen',
  price: '',
  review: 'Great for iced coffee',
  platforms: ['shopee'],
  links: [],
  media: [],
  ...over,
})
const list = [product({}), product({ id: 2, name: 'Bud Vase', category: 'Decor', review: 'Handmade', platforms: ['whatsapp'] })]
const ids = (f: Partial<Parameters<typeof filterProducts>[1]>) => filterProducts(list, { q: '', category: 'All', platform: 'all', ...f }).map((p) => p.id)

test('no filter returns all products', () => expect(ids({})).toEqual([1, 2]))
test('category filter', () => expect(ids({ category: 'Decor' })).toEqual([2]))
test('platform filter', () => expect(ids({ platform: 'shopee' })).toEqual([1]))
test('search reads name, category, and review, and ignores case and outer spaces', () => {
  expect(ids({ q: ' TUMBLER ' })).toEqual([1])
  expect(ids({ q: 'decor' })).toEqual([2])
  expect(ids({ q: 'iced coffee' })).toEqual([1])
  expect(ids({ q: 'nothing' })).toEqual([])
})
test('filters combine', () => expect(ids({ category: 'Kitchen', platform: 'whatsapp' })).toEqual([]))
test('wrap keeps a carousel index in range', () => {
  expect(wrap(3, 3)).toBe(0)
  expect(wrap(-1, 3)).toBe(2)
  expect(wrap(1, 3)).toBe(1)
})
