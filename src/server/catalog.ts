import { and, asc, desc, eq, notInArray, sql } from 'drizzle-orm'
import type { Db } from './db'
import { admin, category, job, link, media, product, profile } from './schema'
import { DEFAULT_WATERMARK, type JobInput, PLATFORMS, type ProductInput, validateWatermark, type WatermarkSettings } from './validate'

export class UserError extends Error {}

function load(db: Db) {
  return {
    profile: db.select().from(profile).get()!,
    categories: db.select().from(category).orderBy(asc(category.position)).all(),
    products: db.select().from(product).orderBy(asc(product.position)).all(),
    media: db.select().from(media).orderBy(asc(media.position)).all(),
    links: db.select().from(link).orderBy(asc(link.position)).all(),
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
        platforms: PLATFORMS.filter((k) => d.links.some((l) => l.productId === p.id && l.platform === k)),
        links: d.links.filter((l) => l.productId === p.id).map((l) => ({ id: l.id, platform: l.platform, label: l.label })),
        media: d.media.filter((m) => m.productId === p.id).map((m) => ({ type: m.type, url: `${mediaBase}/${m.r2Key}` })),
      })),
  }
}
export type PublicPage = ReturnType<typeof getPublicPage>
export type PublicProduct = PublicPage['products'][number]

function watermarkSettings(p: typeof profile.$inferSelect): WatermarkSettings {
  const saved = p.watermark ? JSON.parse(p.watermark) : {}
  const result = validateWatermark({ ...saved, text: saved.text || p.handle || p.name })
  return result.ok ? result.value : { ...DEFAULT_WATERMARK, text: '' }
}

export function getAdminData(db: Db, mediaBase: string) {
  const d = load(db)
  const { watermark: _, ...p } = d.profile
  return {
    profile: { ...p, avatarUrl: p.avatarKey ? `${mediaBase}/${p.avatarKey}` : null },
    watermark: watermarkSettings(d.profile),
    jobs: db
      .select()
      .from(job)
      .orderBy(desc(job.id))
      .all()
      .map((j) => ({
        id: j.id,
        type: j.type,
        name: j.name,
        status: j.status,
        progress: j.progress,
        error: j.error,
        key: j.outputKey,
        url: j.outputKey ? `${mediaBase}/${j.outputKey}` : null,
      })),
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
      hidden: p.hidden,
      links: d.links
        .filter((l) => l.productId === p.id)
        .map((l) => ({ id: l.id, platform: l.platform, label: l.label, url: l.url, clicks: l.clicks })),
      media: d.media
        .filter((m) => m.productId === p.id)
        .map((m) => ({ type: m.type, key: m.r2Key, url: `${mediaBase}/${m.r2Key}` })),
    })),
    admins: db.select().from(admin).orderBy(asc(admin.email)).all().map((a) => a.email),
  }
}
export type AdminData = ReturnType<typeof getAdminData>
export type AdminProduct = AdminData['products'][number]

// A key can be on more than one row: a double save, a crafted request, or a library file that is also on a product.
// Delete the object only when no media row and no library item uses it.
function unused(db: Pick<Db, 'select'>, keys: string[]): string[] {
  return keys.filter(
    (key) =>
      !db.select().from(media).where(eq(media.r2Key, key)).get() && !db.select().from(job).where(eq(job.outputKey, key)).get(),
  )
}

export function saveProduct(db: Db, input: ProductInput): { id: number; removedKeys: string[] } {
  const { id: inputId, media: items, links, ...fields } = input
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
    // Update a link in place, so its click count stays with it.
    const kept = links.flatMap((l) => (l.id === undefined ? [] : [l.id]))
    tx.delete(link).where(and(eq(link.productId, id), notInArray(link.id, kept))).run()
    links.forEach(({ id: linkId, ...l }, position) => {
      const row = { ...l, position }
      const updated =
        linkId !== undefined &&
        tx.update(link).set(row).where(and(eq(link.id, linkId), eq(link.productId, id))).returning({ id: link.id }).get()
      if (!updated) tx.insert(link).values({ ...row, productId: id }).run()
    })
    return { id, removedKeys: unused(tx, oldKeys) }
  })
}

export function deleteProduct(db: Db, id: number): string[] {
  const keys = db.select().from(media).where(eq(media.productId, id)).all().map((m) => m.r2Key)
  db.delete(product).where(eq(product.id, id)).run()
  return unused(db, keys)
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

export function recordClick(db: Db, linkId: number): string | null {
  const row = db
    .select({ url: link.url })
    .from(link)
    .innerJoin(product, eq(product.id, link.productId))
    .where(and(eq(link.id, linkId), eq(product.hidden, false)))
    .get()
  if (!row) return null
  db.update(link).set({ clicks: sql`${link.clicks} + 1` }).where(eq(link.id, linkId)).run()
  return row.url
}

export type AdminJob = AdminData['jobs'][number]

// The settings used for a batch also become the defaults for the next one.
export function addJobs(db: Db, jobs: JobInput[], settings: WatermarkSettings) {
  const json = JSON.stringify(settings)
  db.transaction((tx) => {
    tx.update(profile).set({ watermark: json }).where(eq(profile.id, 1)).run()
    const createdAt = Date.now()
    tx.insert(job)
      .values(jobs.map((j) => ({ type: j.type, name: j.name, sourceKey: j.key, settings: json, createdAt })))
      .run()
  })
}

// Claims the oldest queued job. The status check in the UPDATE stops two workers taking the same job.
export function claimJob(db: Db) {
  const next = db.select({ id: job.id }).from(job).where(eq(job.status, 'queued')).orderBy(asc(job.id)).get()
  if (!next) return undefined
  return db
    .update(job)
    .set({ status: 'processing', progress: 0, error: '' })
    .where(and(eq(job.id, next.id), eq(job.status, 'queued')))
    .returning()
    .get()
}

// A job that was processing when the server stopped has no worker. It goes back in the queue.
export function requeueStuckJobs(db: Db) {
  db.update(job).set({ status: 'queued' }).where(eq(job.status, 'processing')).run()
}

export function setJobProgress(db: Db, id: number, progress: number) {
  db.update(job).set({ progress }).where(eq(job.id, id)).run()
}

export function finishJob(db: Db, id: number, outputKey: string) {
  db.update(job).set({ status: 'done', progress: 100, outputKey, sourceKey: '' }).where(eq(job.id, id)).run()
}

export function failJob(db: Db, id: number, error: string) {
  db.update(job).set({ status: 'failed', error }).where(eq(job.id, id)).run()
}

export function retryJob(db: Db, id: number) {
  const row = db.select().from(job).where(eq(job.id, id)).get()
  if (row?.status !== 'failed') throw new UserError('Only a failed file can be tried again.')
  db.update(job).set({ status: 'queued', progress: 0, error: '' }).where(eq(job.id, id)).run()
}

// Returns the R2 keys to delete: the original if it is still there, and the result if no product uses it.
export function deleteJob(db: Db, id: number): string[] {
  const row = db.select().from(job).where(eq(job.id, id)).get()
  if (!row) return []
  if (row.status === 'processing') throw new UserError('Wait until this file is finished.')
  db.delete(job).where(eq(job.id, id)).run()
  return [row.sourceKey, ...unused(db, row.outputKey ? [row.outputKey] : [])].filter(Boolean)
}

// The key comes from the job row, so a request cannot attach a file that is not in the library.
export function attachMedia(db: Db, productId: number, jobId: number) {
  const row = db.select().from(job).where(eq(job.id, jobId)).get()
  if (row?.status !== 'done') throw new UserError('This file is not ready yet.')
  if (!db.select().from(product).where(eq(product.id, productId)).get()) throw new UserError('This product no longer exists.')
  const taken = db.select().from(media).where(and(eq(media.productId, productId), eq(media.r2Key, row.outputKey))).get()
  if (taken) throw new UserError('This file is already on that product.')
  const last = db
    .select({ v: sql<number>`coalesce(max(${media.position}), -1)` })
    .from(media)
    .where(eq(media.productId, productId))
    .get()!.v
  db.insert(media).values({ productId, type: row.type, r2Key: row.outputKey, position: last + 1 }).run()
}
