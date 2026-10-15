import { and, asc, desc, eq, inArray, lt, ne, notInArray, or, sql } from 'drizzle-orm'
import type { Db } from './db'
import { admin, category, click, folder, job, link, media, product, profile } from './schema'
import { type BioSize, DEFAULT_WATERMARK, type JobInput, PLATFORMS, SOCIALS, type Socials, type ProductInput, validateWatermark, type WatermarkSettings } from './validate'

export class UserError extends Error {}

function socialsOf(p: typeof profile.$inferSelect): Socials {
  try {
    return JSON.parse(p.socials)
  } catch {
    return {}
  }
}

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
      bioSize: d.profile.bioSize,
      whatsapp: d.profile.whatsapp,
      avatarUrl: d.profile.avatarKey ? `${mediaBase}/${d.profile.avatarKey}` : null,
      socials: SOCIALS.flatMap((platform) => {
        const url = socialsOf(d.profile)[platform]
        return url ? [{ platform, url }] : []
      }),
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
  const jobs = db.select().from(job).orderBy(desc(job.id)).all()
  return {
    profile: { ...p, socials: socialsOf(d.profile), avatarUrl: p.avatarKey ? `${mediaBase}/${p.avatarKey}` : null },
    watermark: watermarkSettings(d.profile),
    folders: db
      .select()
      .from(folder)
      .orderBy(sql`${folder.name} collate nocase`)
      .all()
      .map((f) => ({ ...f, count: jobs.filter((j) => j.folderId === f.id).length })),
    jobs: jobs.map((j) => ({
        id: j.id,
        type: j.type,
        name: j.name,
        status: j.status,
        progress: j.progress,
        error: j.error,
        compressOnly: JSON.parse(j.settings).compressOnly === true,
        watermarking: JSON.parse(j.settings).compressOnly !== true && j.outputKey !== '' && j.status !== 'done',
        watermark:
          JSON.parse(j.settings).compressOnly === true
            ? j.tagged ? ('manual' as const) : null
            : j.outputKey !== '' && j.status !== 'done' ? null : ('app' as const),
        folderId: j.folderId,
        // The products that already show this file, so the library can say where it is used.
        productIds: j.outputKey ? [...new Set(d.media.filter((m) => m.r2Key === j.outputKey).map((m) => m.productId))] : [],
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
      const last = tx.select({ v: sql<number>`coalesce(max(${product.position}), -1)` }).from(product).get()!.v
      id = tx.insert(product).values({ ...fields, position: last + 1 }).returning({ id: product.id }).get().id
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

// The list must hold every product once. A list from a page that is out of date is refused, so no product loses its place.
export function reorderProducts(db: Db, ids: number[]) {
  const current = db.select({ id: product.id }).from(product).all().map((p) => p.id)
  if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => current.includes(id))) {
    throw new UserError('The list changed. Reload the page and try again.')
  }
  db.transaction((tx) => {
    ids.forEach((id, position) => tx.update(product).set({ position }).where(eq(product.id, id)).run())
  })
}
export const moveCategory = (db: Db, id: number, dir: -1 | 1) => move(db, category, id, dir)

function freeName(db: Db, table: typeof category | typeof folder, raw: string, exceptId?: number) {
  const noun = table === category ? 'category' : 'folder'
  const name = raw.trim().slice(0, 60)
  if (!name) throw new UserError(`Give the ${noun} a name.`)
  const taken = db.select().from(table).all().find((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== exceptId)
  if (taken) throw new UserError(`That ${noun} already exists`)
  return name
}

export function addCategory(db: Db, raw: string) {
  const name = freeName(db, category, raw)
  const last = db.select({ v: sql<number>`coalesce(max(${category.position}), 0)` }).from(category).get()!.v
  db.insert(category).values({ name, position: last + 1 }).run()
}

export function renameCategory(db: Db, id: number, raw: string) {
  db.update(category).set({ name: freeName(db, category, raw, id) }).where(eq(category.id, id)).run()
}

export function deleteCategory(db: Db, id: number) {
  const n = db.select().from(product).where(eq(product.categoryId, id)).all().length
  if (n) throw new UserError(`Move its ${n} product${n === 1 ? '' : 's'} to another category first`)
  db.delete(category).where(eq(category.id, id)).run()
}

export type ProfileInput = { name: string; handle: string; bio: string; bioSize?: BioSize; whatsapp: string; avatarKey?: string; socials?: Socials }

export function saveProfile(db: Db, input: ProfileInput): string | null {
  const old = db.select().from(profile).get()!.avatarKey
  db.update(profile)
    .set({
      name: input.name.trim().slice(0, 80),
      handle: input.handle.trim().slice(0, 80),
      bio: input.bio.trim().slice(0, 400),
      ...(input.bioSize ? { bioSize: input.bioSize } : {}),
      whatsapp: input.whatsapp.replace(/\D/g, '').slice(0, 20),
      ...(input.avatarKey ? { avatarKey: input.avatarKey } : {}),
      ...(input.socials ? { socials: JSON.stringify(input.socials) } : {}),
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

export function recordClick(db: Db, linkId: number, at = Date.now()): string | null {
  const row = db
    .select({ url: link.url, productId: link.productId, platform: link.platform })
    .from(link)
    .innerJoin(product, eq(product.id, link.productId))
    .where(and(eq(link.id, linkId), eq(product.hidden, false)))
    .get()
  if (!row) return null
  db.transaction((tx) => {
    tx.update(link).set({ clicks: sql`${link.clicks} + 1` }).where(eq(link.id, linkId)).run()
    tx.insert(click).values({ linkId, productId: row.productId, platform: row.platform, at }).run()
  })
  return row.url
}

export type AdminJob = AdminData['jobs'][number]
const PLAIN = JSON.stringify({ compressOnly: true })

export function addMedia(db: Db, input: JobInput) {
  if (db.select().from(job).where(eq(job.outputKey, input.key)).get()) return
  db.insert(job)
    .values({ type: input.type, name: input.name, sourceKey: '', outputKey: input.key, settings: PLAIN, status: 'done', progress: 100, createdAt: Date.now(), hash: input.hash ?? '' })
    .run()
}

export function findMedia(db: Db, hash: string) {
  const row = db.select().from(job).where(and(eq(job.hash, hash), ne(job.status, 'failed'))).orderBy(desc(job.id)).get()
  return row ? { status: row.status, type: row.type, key: row.outputKey } : null
}

// The settings used for a batch also become the defaults for the next one.
export function addJobs(db: Db, jobs: JobInput[], settings: WatermarkSettings, folderId: number | null = null) {
  const json = JSON.stringify(settings)
  db.transaction((tx) => {
    if (folderId !== null && !tx.select().from(folder).where(eq(folder.id, folderId)).get()) {
      throw new UserError('That folder no longer exists.')
    }
    tx.update(profile).set({ watermark: json }).where(eq(profile.id, 1)).run()
    const createdAt = Date.now()
    tx.insert(job)
      .values(jobs.map((j) => ({ type: j.type, name: j.name, sourceKey: j.key, settings: json, createdAt, folderId, hash: j.hash ?? '' })))
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

export function finishJob(db: Db, id: number, outputKey: string, outputBytes = 0) {
  const old = db.select({ key: job.outputKey }).from(job).where(eq(job.id, id)).get()?.key
  if (old && old !== outputKey) db.update(media).set({ r2Key: outputKey }).where(eq(media.r2Key, old)).run()
  db.update(job).set({ status: 'done', progress: 100, outputKey, outputBytes, sourceKey: '' }).where(eq(job.id, id)).run()
}

// A product video that the editor sends to the server to compress. It goes through the same queue as watermarks.
export function addCompressJob(db: Db, input: JobInput): number {
  return db
    .insert(job)
    .values({ type: 'video', name: input.name, sourceKey: input.key, settings: PLAIN, createdAt: Date.now(), hash: input.hash ?? '' })
    .returning({ id: job.id })
    .get().id
}

export function takeJob(db: Db, id: number, mediaBase: string) {
  const row = db.select().from(job).where(eq(job.id, id)).get()
  if (!row) throw new UserError('This video is no longer in the library.')
  if (row.status === 'queued') {
    const ahead = db
      .select({ count: sql<number>`count(*)` })
      .from(job)
      .where(or(eq(job.status, 'processing'), and(eq(job.status, 'queued'), lt(job.id, id))))
      .get()!.count
    return { status: row.status, progress: row.progress, error: row.error, ahead }
  }
  if (row.status !== 'done') return { status: row.status, progress: row.progress, error: row.error }
  return { status: row.status, progress: 100, error: '', key: row.outputKey, url: `${mediaBase}/${row.outputKey}`, bytes: row.outputBytes }
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
  const users = row.outputKey ? productsUsing(db, row.outputKey) : []
  if (users.length) throw new UserError(`This file is on ${users.join(', ')}. Remove it from ${users.length === 1 ? 'that product' : 'those products'} first.`)
  db.delete(job).where(eq(job.id, id)).run()
  return [...new Set([row.sourceKey, ...unused(db, row.outputKey ? [row.outputKey] : [])].filter(Boolean))]
}

function plainFile(db: Db, id: number) {
  const row = db.select().from(job).where(eq(job.id, id)).get()
  if (row?.status !== 'done' || !row.outputKey) throw new UserError('This file is not ready yet.')
  if (JSON.parse(row.settings).compressOnly !== true) throw new UserError('This file already has your watermark.')
  return row
}

export function tagWatermark(db: Db, id: number, tagged: boolean) {
  plainFile(db, id)
  db.update(job).set({ tagged }).where(eq(job.id, id)).run()
}

export function watermarkJob(db: Db, id: number) {
  const row = plainFile(db, id)
  if (row.tagged) throw new UserError('This file is tagged as already watermarked.')
  const settings = watermarkSettings(db.select().from(profile).get()!)
  if (!settings.text) throw new UserError('Add the watermark text in the Watermark tab first.')
  db.update(job)
    .set({ sourceKey: row.outputKey, settings: JSON.stringify(settings), status: 'queued', progress: 0, error: '' })
    .where(eq(job.id, id))
    .run()
}

export function downloadName(db: Db, id: number) {
  const row = db.select().from(job).where(eq(job.id, id)).get()
  if (!row?.outputKey) throw new UserError('This file is not ready yet.')
  const ext = row.outputKey.split('.').pop()
  return { key: row.outputKey, name: `${row.name.replace(/\.[^.]*$/, '') || 'media'}.${ext}` }
}

function productsUsing(db: Db, key: string) {
  const rows = db.select({ name: product.name }).from(media).innerJoin(product, eq(product.id, media.productId)).where(eq(media.r2Key, key)).all()
  return [...new Set(rows.map((r) => r.name))]
}

export function deleteUnusedJobs(db: Db): string[] {
  const used = new Set(db.select({ key: media.r2Key }).from(media).all().map((m) => m.key))
  const rows = db.select().from(job).where(eq(job.status, 'done')).all().filter((j) => !used.has(j.outputKey))
  if (!rows.length) return []
  db.delete(job).where(inArray(job.id, rows.map((j) => j.id))).run()
  return unused(db, [...new Set(rows.map((j) => j.outputKey).filter(Boolean))])
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

export function addFolder(db: Db, raw: string): number {
  return db.insert(folder).values({ name: freeName(db, folder, raw) }).returning({ id: folder.id }).get().id
}

export function renameFolder(db: Db, id: number, raw: string) {
  db.update(folder).set({ name: freeName(db, folder, raw, id) }).where(eq(folder.id, id)).run()
}

// The foreign key sets folder_id to null, so the files stay in the library with no folder.
export function deleteFolder(db: Db, id: number) {
  db.delete(folder).where(eq(folder.id, id)).run()
}

export function moveJob(db: Db, id: number, folderId: number | null) {
  if (folderId !== null && !db.select().from(folder).where(eq(folder.id, folderId)).get()) {
    throw new UserError('That folder no longer exists.')
  }
  db.update(job).set({ folderId }).where(eq(job.id, id)).run()
}
