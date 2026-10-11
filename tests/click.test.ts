import { expect, test } from 'bun:test'
import { addCategory, getAdminData, saveProduct } from '../src/server/catalog'
import { resolveClick } from '../src/server/click'
import { openDb } from '../src/server/db'

const db = openDb(':memory:')
addCategory(db, 'Kitchen')
const { id } = saveProduct(db, {
  name: 'Tumbler',
  categoryId: getAdminData(db, '').categories[0].id,
  price: '',
  review: '',
  shopeeUrl: 'https://shopee.com.my/x',
  tiktokUrl: '',
  whatsappUrl: '',
  hidden: false,
  media: [],
})

test('a good request returns the stored link', () => {
  expect(resolveClick(db, String(id), 'shopee')).toBe('https://shopee.com.my/x')
})

test.each([
  ['abc', 'shopee'],
  ['1.5', 'shopee'],
  ['', 'shopee'],
  [String(id), 'lazada'],
  [String(id), 'tiktok'],
  ['999', 'shopee'],
])('request %s / %s returns null', (productId, platform) => {
  expect(resolveClick(db, productId, platform)).toBeNull()
})
