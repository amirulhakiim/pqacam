import { addCategory, getAdminData, saveProduct, saveProfile } from '../src/server/catalog'
import { openDb } from '../src/server/db'
import { env } from '../src/server/env'

const db = openDb(env('DATABASE_PATH'), process.env.OWNER_EMAIL)
if (getAdminData(db, '').categories.length) {
  console.log('The database already has data. Nothing added.')
  process.exit(0)
}

saveProfile(db, {
  name: 'The Cosy Corner',
  handle: '@thecosycorner',
  bio: 'Little things that make home feel softer. Tap any item to read my honest review.',
  whatsapp: '60123456789',
})
addCategory(db, 'Kitchen')
addCategory(db, 'Decor')
const [kitchen, decor] = getAdminData(db, '').categories
const base = { price: '', review: 'I use these every day.', shopeeUrl: '', tiktokUrl: '', whatsappUrl: '', hidden: false, media: [] }
saveProduct(db, { ...base, name: 'Bud Vase', categoryId: decor.id, whatsappUrl: 'https://wa.me/60123456789' })
saveProduct(db, {
  ...base,
  name: 'Glass Tumbler Set',
  categoryId: kitchen.id,
  price: 'RM 24.90',
  shopeeUrl: 'https://shopee.com.my/',
  tiktokUrl: 'https://www.tiktok.com/shop',
})
console.log(`Sample data added to ${env('DATABASE_PATH')}.`)
