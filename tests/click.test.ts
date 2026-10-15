import { expect, test } from 'bun:test'
import { addCategory, getAdminData, saveProduct } from '../src/server/catalog'
import { resolveClick } from '../src/server/click'
import { openDb } from '../src/server/db'

const db = openDb(':memory:')
addCategory(db, 'Kitchen')
saveProduct(db, {
  name: 'Tumbler',
  categoryId: getAdminData(db, '').categories[0].id,
  price: '',
  review: '',
  links: [{ platform: 'shopee', label: '', url: 'https://shopee.com.my/x' }],
  hidden: false,
  media: [],
})

const linkId = String(getAdminData(db, '').products[0].links[0].id)

test('a good request returns the stored link', () => {
  expect(resolveClick(db, linkId)).toBe('https://shopee.com.my/x')
})

test.each(['abc', '1.5', '', '-1', '999'])('request %p returns null', (id) => {
  expect(resolveClick(db, id)).toBeNull()
})
