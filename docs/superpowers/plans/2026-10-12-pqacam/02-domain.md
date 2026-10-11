# 02. Domain

Part of the [pqacam implementation plan](README.md). The Global Constraints in that file apply to each task.

## Task 3: Validation

**Files:**
- Create: `src/server/validate.ts`
- Test: `tests/validate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, all from `src/server/validate.ts`:
  - `PLATFORMS: readonly ['shopee', 'tiktok', 'whatsapp']`, type `Platform`, `isPlatform(v: string): v is Platform`
  - type `Result<T> = { ok: true; value: T } | { ok: false; error: string }`
  - type `MediaInput = { type: 'photo' | 'video'; key: string }`
  - type `ProductInput = { id?: number; name: string; categoryId: number; price: string; review: string; shopeeUrl: string; tiktokUrl: string; whatsappUrl: string; hidden: boolean; media: MediaInput[] }`
  - `validateProduct(raw: unknown): Result<ProductInput>`
  - `validateEmail(raw: unknown): Result<string>` (lower case)
  - type `UploadKind = 'photo' | 'video' | 'avatar'`
  - `validateUpload(raw: unknown): Result<{ kind: UploadKind; contentType: string; size: number; ext: string }>`
  - `AVATAR_KEY: RegExp`

- [ ] **Step 1: Write the failing tests**

`tests/validate.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { validateEmail, validateProduct, validateUpload } from '../src/server/validate'

const KEY = 'photo/0b9f6c1e-1c2d-4e3f-8a4b-5c6d7e8f9a0b.jpg'
const good = {
  name: ' Tumbler ',
  categoryId: 1,
  price: 'RM 24.90',
  review: 'Nice',
  shopeeUrl: 'https://shopee.com.my/x',
  tiktokUrl: '',
  whatsappUrl: '',
  hidden: false,
  media: [{ type: 'photo', key: KEY }],
}
const error = (raw: unknown) => {
  const r = validateProduct(raw)
  return r.ok ? null : r.error
}

test('a valid product passes and the name is trimmed', () => {
  const r = validateProduct(good)
  expect(r.ok && r.value.name).toBe('Tumbler')
})

test('a product needs a name', () => {
  expect(error({ ...good, name: '   ' })).toBe('Give your product a name.')
})

test('a product needs one buy link', () => {
  expect(error({ ...good, shopeeUrl: '' })).toBe('Add at least one Shopee, TikTok or WhatsApp link.')
})

test.each(['http://shopee.com.my/x', 'javascript:alert(1)', 'shopee.com.my/x', 'https://'])(
  'link %s is refused',
  (shopeeUrl) => {
    expect(error({ ...good, shopeeUrl })).toBe('Links must start with https://')
  },
)

test('a media key that the server did not make is refused', () => {
  expect(error({ ...good, media: [{ type: 'photo', key: '../secret' }] })).toBe('Upload the file again.')
})

test('input that is not an object is refused', () => {
  expect(validateProduct(null).ok).toBe(false)
  expect(validateProduct('x').ok).toBe(false)
})

test('an email is lower-cased and checked', () => {
  expect(validateEmail(' Name@Gmail.com ')).toEqual({ ok: true, value: 'name@gmail.com' })
  expect(validateEmail('nope').ok).toBe(false)
})

test('upload rules', () => {
  expect(validateUpload({ kind: 'photo', contentType: 'image/jpeg', size: 300_000 })).toMatchObject({
    ok: true,
    value: { ext: 'jpg' },
  })
  expect(validateUpload({ kind: 'video', contentType: 'video/quicktime', size: 1 })).toMatchObject({
    ok: true,
    value: { ext: 'mov' },
  })
  expect(validateUpload({ kind: 'photo', contentType: 'image/png', size: 1 }).ok).toBe(false)
  expect(validateUpload({ kind: 'video', contentType: 'video/mp4', size: 50 * 1024 * 1024 + 1 }).ok).toBe(false)
  expect(validateUpload({ kind: 'photo', contentType: 'image/jpeg', size: 0 }).ok).toBe(false)
  expect(validateUpload({ kind: 'exe', contentType: 'image/jpeg', size: 1 }).ok).toBe(false)
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/validate.test.ts`
Expected: FAIL. `Cannot find module '../src/server/validate'`.

- [ ] **Step 3: Write the module**

`src/server/validate.ts`:

```ts
export const PLATFORMS = ['shopee', 'tiktok', 'whatsapp'] as const
export type Platform = (typeof PLATFORMS)[number]
export const isPlatform = (v: string): v is Platform => (PLATFORMS as readonly string[]).includes(v)

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string) => ({ ok: false, error }) as const

export type MediaInput = { type: 'photo' | 'video'; key: string }
export type ProductInput = {
  id?: number
  name: string
  categoryId: number
  price: string
  review: string
  shopeeUrl: string
  tiktokUrl: string
  whatsappUrl: string
  hidden: boolean
  media: MediaInput[]
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const MEDIA_KEY = { photo: new RegExp(`^photo/${UUID}\\.jpg$`), video: new RegExp(`^video/${UUID}\\.(mp4|webm|mov)$`) }
export const AVATAR_KEY = new RegExp(`^avatar/${UUID}\\.jpg$`)

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function isHttps(link: string) {
  try {
    const url = new URL(link)
    return url.protocol === 'https:' && url.hostname.includes('.')
  } catch {
    return false
  }
}

export function validateProduct(raw: unknown): Result<ProductInput> {
  if (!raw || typeof raw !== 'object') return fail('Give your product a name.')
  const r = raw as Record<string, unknown>
  const value: ProductInput = {
    id: Number.isInteger(r.id) ? (r.id as number) : undefined,
    name: text(r.name, 200),
    categoryId: Number.isInteger(r.categoryId) ? (r.categoryId as number) : 0,
    price: text(r.price, 40),
    review: text(r.review, 5000),
    shopeeUrl: text(r.shopeeUrl, 2000),
    tiktokUrl: text(r.tiktokUrl, 2000),
    whatsappUrl: text(r.whatsappUrl, 2000),
    hidden: r.hidden === true,
    media: [],
  }
  if (!value.name) return fail('Give your product a name.')
  const links = [value.shopeeUrl, value.tiktokUrl, value.whatsappUrl].filter(Boolean)
  if (!links.length) return fail('Add at least one Shopee, TikTok or WhatsApp link.')
  if (!links.every(isHttps)) return fail('Links must start with https://')
  for (const m of Array.isArray(r.media) ? r.media.slice(0, 20) : []) {
    const type = m?.type === 'video' ? 'video' : 'photo'
    if (typeof m?.key !== 'string' || !MEDIA_KEY[type].test(m.key)) return fail('Upload the file again.')
    value.media.push({ type, key: m.key })
  }
  return { ok: true, value }
}

export function validateEmail(raw: unknown): Result<string> {
  const email = text(raw, 254).toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? { ok: true, value: email } : fail('Enter a valid Google email')
}

export type UploadKind = 'photo' | 'video' | 'avatar'
const MB = 1024 * 1024
const UPLOAD: Record<UploadKind, { max: number; types: Record<string, string> }> = {
  photo: { max: 2 * MB, types: { 'image/jpeg': 'jpg' } },
  avatar: { max: 2 * MB, types: { 'image/jpeg': 'jpg' } },
  video: { max: 50 * MB, types: { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' } },
}

export function validateUpload(raw: unknown): Result<{ kind: UploadKind; contentType: string; size: number; ext: string }> {
  const r = (raw ?? {}) as Record<string, unknown>
  const rule = UPLOAD[r.kind as UploadKind]
  if (!rule) return fail('This file type is not supported.')
  const ext = rule.types[r.contentType as string]
  if (!ext) return fail(r.kind === 'video' ? 'Use an MP4, WebM or MOV video.' : 'This file type is not supported.')
  const size = r.size as number
  if (!Number.isInteger(size) || size <= 0) return fail('This file is empty.')
  if (size > rule.max) return fail(r.kind === 'video' ? 'Videos can be 50 MB at most.' : 'This photo is too large.')
  return { ok: true, value: { kind: r.kind as UploadKind, contentType: r.contentType as string, size, ext } }
}
```

A resized 1000 px JPEG is less than 1 MB in practice, so the 2 MB photo limit only stops a file that did not go through the resize step.

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/validate.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add input validation"
```

## Task 4: Catalog functions

**Files:**
- Create: `src/server/catalog.ts`
- Test: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: `Db`, `openDb` (Task 2), tables (Task 2), `PLATFORMS`, `Platform`, `ProductInput` (Task 3).
- Produces, all from `src/server/catalog.ts`. `mediaBase` is the public bucket origin with no slash at the end.
  - `class UserError extends Error` (the message is safe to show to an admin)
  - `getPublicPage(db, mediaBase): PublicPage`
  - `getAdminData(db, mediaBase): AdminData`
  - `saveProduct(db, input: ProductInput): { id: number; removedKeys: string[] }`
  - `deleteProduct(db, id: number): string[]` (R2 keys to delete)
  - `setHidden(db, id: number, hidden: boolean): void`
  - `moveProduct(db, id: number, dir: -1 | 1): void`
  - `addCategory(db, name: string): void`, `renameCategory(db, id: number, name: string): void`, `moveCategory(db, id: number, dir: -1 | 1): void`, `deleteCategory(db, id: number): void`
  - `saveProfile(db, input: ProfileInput): string | null` (the replaced avatar key, if any)
  - `isAdmin(db, email: string): boolean`, `addAdmin(db, email: string): void`, `removeAdmin(db, email: string, self: string): void`
  - `recordClick(db, productId: number, platform: Platform): string | null`
  - types `PublicPage`, `PublicProduct`, `AdminData`, `AdminProduct`, `ProfileInput`

- [ ] **Step 1: Write the failing tests**

`tests/catalog.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun test tests/catalog.test.ts`
Expected: FAIL. `Cannot find module '../src/server/catalog'`.

- [ ] **Step 3: Write the module**

`src/server/catalog.ts`:

```ts
import { asc, eq, sql } from 'drizzle-orm'
import type { Db } from './db'
import { admin, category, media, product, profile } from './schema'
import { PLATFORMS, type Platform, type ProductInput } from './validate'

export class UserError extends Error {}

const URL_FIELD = { shopee: 'shopeeUrl', tiktok: 'tiktokUrl', whatsapp: 'whatsappUrl' } as const
const CLICK_FIELD = { shopee: 'shopeeClicks', tiktok: 'tiktokClicks', whatsapp: 'whatsappClicks' } as const

function load(db: Db) {
  return {
    profile: db.select().from(profile).get()!,
    categories: db.select().from(category).orderBy(asc(category.position)).all(),
    products: db.select().from(product).orderBy(asc(product.position)).all(),
    media: db.select().from(media).orderBy(asc(media.position)).all(),
  }
}

export function getPublicPage(db: Db, mediaBase: string) {
  const d = load(db)
  const categoryName = new Map(d.categories.map((c) => [c.id, c.name]))
  return {
    profile: {
      name: d.profile.name,
      handle: d.profile.handle,
      bio: d.profile.bio,
      avatarUrl: d.profile.avatarKey ? `${mediaBase}/${d.profile.avatarKey}` : null,
    },
    categories: d.categories.map((c) => c.name),
    products: d.products
      .filter((p) => !p.hidden)
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: categoryName.get(p.categoryId) ?? '',
        price: p.price,
        review: p.review,
        platforms: PLATFORMS.filter((k) => p[URL_FIELD[k]]),
        media: d.media.filter((m) => m.productId === p.id).map((m) => ({ type: m.type, url: `${mediaBase}/${m.r2Key}` })),
      })),
  }
}
export type PublicPage = ReturnType<typeof getPublicPage>
export type PublicProduct = PublicPage['products'][number]

export function getAdminData(db: Db, mediaBase: string) {
  const d = load(db)
  return {
    profile: { ...d.profile, avatarUrl: d.profile.avatarKey ? `${mediaBase}/${d.profile.avatarKey}` : null },
    categories: d.categories.map((c) => ({
      id: c.id,
      name: c.name,
      count: d.products.filter((p) => p.categoryId === c.id).length,
    })),
    products: d.products.map((p) => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      price: p.price,
      review: p.review,
      shopeeUrl: p.shopeeUrl,
      tiktokUrl: p.tiktokUrl,
      whatsappUrl: p.whatsappUrl,
      hidden: p.hidden,
      clicks: { shopee: p.shopeeClicks, tiktok: p.tiktokClicks, whatsapp: p.whatsappClicks },
      media: d.media
        .filter((m) => m.productId === p.id)
        .map((m) => ({ type: m.type, key: m.r2Key, url: `${mediaBase}/${m.r2Key}` })),
    })),
    admins: db.select().from(admin).orderBy(asc(admin.email)).all().map((a) => a.email),
  }
}
export type AdminData = ReturnType<typeof getAdminData>
export type AdminProduct = AdminData['products'][number]

export function saveProduct(db: Db, input: ProductInput): { id: number; removedKeys: string[] } {
  const { id: inputId, media: items, ...fields } = input
  return db.transaction((tx) => {
    if (!tx.select().from(category).where(eq(category.id, fields.categoryId)).get()) {
      throw new UserError('Choose a category.')
    }
    let id: number
    let oldKeys: string[] = []
    if (inputId === undefined) {
      const top = tx.select({ v: sql<number>`coalesce(min(${product.position}), 1)` }).from(product).get()!.v
      id = tx.insert(product).values({ ...fields, position: top - 1 }).returning({ id: product.id }).get().id
    } else {
      const row = tx.update(product).set(fields).where(eq(product.id, inputId)).returning({ id: product.id }).get()
      if (!row) throw new UserError('This product no longer exists.')
      id = row.id
      oldKeys = tx.select().from(media).where(eq(media.productId, id)).all().map((m) => m.r2Key)
      tx.delete(media).where(eq(media.productId, id)).run()
    }
    if (items.length) {
      tx.insert(media)
        .values(items.map((m, position) => ({ productId: id, type: m.type, r2Key: m.key, position })))
        .run()
    }
    const kept = new Set(items.map((m) => m.key))
    return { id, removedKeys: oldKeys.filter((k) => !kept.has(k)) }
  })
}

export function deleteProduct(db: Db, id: number): string[] {
  const keys = db.select().from(media).where(eq(media.productId, id)).all().map((m) => m.r2Key)
  db.delete(product).where(eq(product.id, id)).run()
  return keys
}

export function setHidden(db: Db, id: number, hidden: boolean) {
  db.update(product).set({ hidden }).where(eq(product.id, id)).run()
}

function move(db: Db, table: typeof product | typeof category, id: number, dir: -1 | 1) {
  const rows = db.select({ id: table.id, position: table.position }).from(table).orderBy(asc(table.position)).all()
  const from = rows.findIndex((r) => r.id === id)
  const to = from + dir
  if (from < 0 || to < 0 || to >= rows.length) return
  db.transaction((tx) => {
    tx.update(table).set({ position: rows[to].position }).where(eq(table.id, rows[from].id)).run()
    tx.update(table).set({ position: rows[from].position }).where(eq(table.id, rows[to].id)).run()
  })
}
export const moveProduct = (db: Db, id: number, dir: -1 | 1) => move(db, product, id, dir)
export const moveCategory = (db: Db, id: number, dir: -1 | 1) => move(db, category, id, dir)

function freeCategoryName(db: Db, raw: string, exceptId?: number) {
  const name = raw.trim().slice(0, 60)
  if (!name) throw new UserError('Give the category a name.')
  const taken = db.select().from(category).all().find((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== exceptId)
  if (taken) throw new UserError('That category already exists')
  return name
}

export function addCategory(db: Db, raw: string) {
  const name = freeCategoryName(db, raw)
  const last = db.select({ v: sql<number>`coalesce(max(${category.position}), 0)` }).from(category).get()!.v
  db.insert(category).values({ name, position: last + 1 }).run()
}

export function renameCategory(db: Db, id: number, raw: string) {
  db.update(category).set({ name: freeCategoryName(db, raw, id) }).where(eq(category.id, id)).run()
}

export function deleteCategory(db: Db, id: number) {
  const n = db.select().from(product).where(eq(product.categoryId, id)).all().length
  if (n) throw new UserError(`Move its ${n} product${n === 1 ? '' : 's'} to another category first`)
  db.delete(category).where(eq(category.id, id)).run()
}

export type ProfileInput = { name: string; handle: string; bio: string; whatsapp: string; avatarKey?: string }

export function saveProfile(db: Db, input: ProfileInput): string | null {
  const old = db.select().from(profile).get()!.avatarKey
  db.update(profile)
    .set({
      name: input.name.trim().slice(0, 80),
      handle: input.handle.trim().slice(0, 80),
      bio: input.bio.trim().slice(0, 400),
      whatsapp: input.whatsapp.replace(/\D/g, '').slice(0, 20),
      ...(input.avatarKey ? { avatarKey: input.avatarKey } : {}),
    })
    .where(eq(profile.id, 1))
    .run()
  return input.avatarKey && old && old !== input.avatarKey ? old : null
}

export function isAdmin(db: Db, email: string): boolean {
  return !!db.select().from(admin).where(eq(admin.email, email.trim().toLowerCase())).get()
}

export function addAdmin(db: Db, email: string) {
  if (isAdmin(db, email)) throw new UserError('Already has access')
  db.insert(admin).values({ email }).run()
}

export function removeAdmin(db: Db, email: string, self: string) {
  if (email === self.toLowerCase()) throw new UserError('You cannot remove your own access.')
  db.delete(admin).where(eq(admin.email, email)).run()
}

export function recordClick(db: Db, productId: number, platform: Platform): string | null {
  const row = db.select().from(product).where(eq(product.id, productId)).get()
  const url = row && !row.hidden ? row[URL_FIELD[platform]] : ''
  if (!url) return null
  const column = product[CLICK_FIELD[platform]]
  db.update(product)
    .set({ [CLICK_FIELD[platform]]: sql`${column} + 1` })
    .where(eq(product.id, productId))
    .run()
  return url
}
```

An admin cannot remove their own email, and the signed-in admin is always in the list, so the list cannot become empty.

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test tests/catalog.test.ts && bun run typecheck`
Expected: all tests pass. No type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add catalog reads and writes"
```
