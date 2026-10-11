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
