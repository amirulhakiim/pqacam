import { beforeEach, expect, mock, test } from 'bun:test'
import { copyFileSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as c from '../src/server/catalog'
import { type Db, openDb } from '../src/server/db'
import { DEFAULT_WATERMARK, type JobInput } from '../src/server/validate'

// R2 is a local folder here: the worker reads and writes files by key.
const bucket = mkdtempSync(join(tmpdir(), 'bucket-'))
const deleted: string[] = []
const at = (key: string) => join(bucket, key.replaceAll('/', '_'))
// Bun shares module mocks across test files, so the real exports stay for tests/r2.test.ts.
const real = await import('../src/server/r2')
mock.module('../src/server/r2', () => ({
  ...real,
  newKey: (kind: string, ext: string) => `${kind}/${crypto.randomUUID()}.${ext}`,
  getToFile: async (key: string, path: string) => copyFileSync(at(key), path),
  putFile: async (key: string, path: string) => copyFileSync(path, at(key)),
  deleteObjects: async (keys: string[]) => void deleted.push(...keys),
}))
const { runJob } = await import('../src/server/worker')

const BASE = 'https://media.test'
const raw = (n: number, ext = 'jpg') => `raw/00000000-0000-4000-8000-00000000000${n}.${ext}`
const settings = { ...DEFAULT_WATERMARK, text: '@corner' }
let db: Db
const jobs = () => c.getAdminData(db, BASE).jobs
const add = (...list: JobInput[]) => c.addJobs(db, list, settings)
const photo = (n: number): JobInput => ({ type: 'photo', key: raw(n), name: `p${n}.jpg` })

beforeEach(() => {
  db = openDb(':memory:')
  deleted.length = 0
})

function productWith(keys: string[]) {
  c.addCategory(db, `Kitchen ${Math.random()}`)
  const categoryId = c.getAdminData(db, BASE).categories.at(-1)!.id
  return c.saveProduct(db, {
    name: 'Tumbler',
    categoryId,
    price: '',
    review: '',
    hidden: false,
    links: [{ platform: 'shopee', label: '', url: 'https://shopee.com.my/x' }],
    media: keys.map((key) => ({ type: 'photo' as const, key })),
  }).id
}

test('settings default to the handle, and a batch saves its settings as the new default', () => {
  c.saveProfile(db, { name: 'Corner', handle: '@thecosycorner', bio: '', whatsapp: '' })
  expect(c.getAdminData(db, BASE).watermark).toEqual({ ...DEFAULT_WATERMARK, text: '@thecosycorner' })
  c.addJobs(db, [photo(1)], { ...settings, size: 9 })
  expect(c.getAdminData(db, BASE).watermark).toEqual({ ...settings, size: 9 })
})

test('jobs are claimed oldest first, once each, and a stuck job is queued again', () => {
  add(photo(1), photo(2))
  expect(c.claimJob(db)?.name).toBe('p1.jpg')
  expect(c.claimJob(db)?.name).toBe('p2.jpg')
  expect(c.claimJob(db)).toBeUndefined()
  c.requeueStuckJobs(db)
  expect(jobs().map((j) => j.status)).toEqual(['queued', 'queued'])
})

test('only a failed job can be retried, and a processing job cannot be deleted', () => {
  add(photo(1))
  const id = c.claimJob(db)!.id
  expect(() => c.retryJob(db, id)).toThrow(c.UserError)
  expect(() => c.deleteJob(db, id)).toThrow('Wait until this file is finished.')
  c.failJob(db, id, 'x')
  c.retryJob(db, id)
  expect(jobs()[0].status).toBe('queued')
  expect(c.deleteJob(db, id)).toEqual([raw(1)])
})

test('a library file on a product survives deleting either one', () => {
  add(photo(1))
  const id = c.claimJob(db)!.id
  const out = 'photo/00000000-0000-4000-8000-000000000009.jpg'
  c.finishJob(db, id, out)
  const productId = productWith([out])
  expect(c.deleteProduct(db, productId)).toEqual([])
  const again = productWith([out])
  expect(c.deleteJob(db, id)).toEqual([])
  expect(c.deleteProduct(db, again)).toEqual([out])
})

test('attach adds the library file at the end of the product media, once', () => {
  add(photo(1), photo(2))
  const first = c.claimJob(db)!.id
  const out = 'photo/00000000-0000-4000-8000-000000000009.jpg'
  const productId = productWith(['photo/00000000-0000-4000-8000-000000000008.jpg'])
  expect(() => c.attachMedia(db, productId, first)).toThrow('This file is not ready yet.')
  c.finishJob(db, first, out)
  c.attachMedia(db, productId, first)
  expect(c.getAdminData(db, BASE).products[0].media.map((m) => m.key).at(-1)).toBe(out)
  expect(() => c.attachMedia(db, productId, first)).toThrow('This file is already on that product.')
  expect(() => c.attachMedia(db, 999, first)).toThrow('This product no longer exists.')
})

const hasFfmpeg = Bun.which('ffmpeg') && Bun.which('ffprobe')

test.skipIf(!hasFfmpeg)('the worker watermarks a file, stores the result, and deletes the original', async () => {
  await Bun.spawn(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=400x300', '-frames:v', '1', at(raw(1))]).exited
  add(photo(1))
  await runJob(db, c.claimJob(db)!)
  const [j] = jobs()
  expect(j.status).toBe('done')
  expect(j.key).toMatch(/^photo\/.+\.jpg$/)
  expect(existsSync(at(j.key))).toBe(true)
  expect(deleted).toEqual([raw(1)])
})

test('a job whose original is missing fails with a message and keeps the original key', async () => {
  add(photo(7))
  await runJob(db, c.claimJob(db)!)
  expect(jobs()[0]).toMatchObject({ status: 'failed', error: expect.stringContaining('Could not process') })
  expect(deleted).toEqual([])
})

test('folder rules: unique names, upload into a folder, move, and delete keeps the files', () => {
  const trips = c.addFolder(db, 'Trips')
  expect(() => c.addFolder(db, ' trips ')).toThrow('That folder already exists')
  expect(() => c.addFolder(db, '  ')).toThrow('Give the folder a name.')
  c.addJobs(db, [photo(1), photo(2)], settings, trips)
  add(photo(3))
  expect(() => c.addJobs(db, [photo(4)], settings, 999)).toThrow('That folder no longer exists.')
  const ids = jobs().map((j) => j.id)
  c.moveJob(db, ids[0], trips)
  expect(c.getAdminData(db, BASE).folders).toEqual([{ id: trips, name: 'Trips', count: 3 }])
  c.renameFolder(db, trips, 'Holiday')
  c.deleteFolder(db, trips)
  expect(c.getAdminData(db, BASE).folders).toEqual([])
  expect(jobs().map((j) => j.folderId)).toEqual([null, null, null])
  expect(() => c.moveJob(db, ids[0], trips)).toThrow(c.UserError)
})

test('a product video compresses without a watermark, and the editor takes the result out of the library', async () => {
  const raw = 'raw/00000000-0000-4000-8000-00000000000c.mp4'
  await Bun.spawn(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:duration=1', '-f', 'lavfi', '-i', 'sine=duration=1',
    '-shortest', '-c:v', 'libx264', '-c:a', 'aac', at(raw)]).exited
  const id = c.addCompressJob(db, { type: 'video', key: raw, name: 'IMG_1.MOV' })
  expect(c.takeJob(db, id, BASE)).toMatchObject({ status: 'queued', ahead: 0 })
  expect(jobs()[0]).toMatchObject({ compressOnly: true, status: 'queued' })
  await runJob(db, c.claimJob(db)!)
  const taken = c.takeJob(db, id, BASE)
  expect(taken.status).toBe('done')
  expect(taken.key).toMatch(/^video\/.+\.mp4$/)
  expect(taken.bytes).toBeGreaterThan(0)
  expect(jobs()).toEqual([])
  expect(() => c.takeJob(db, id, BASE)).toThrow(c.UserError)
})

test('a queued product video reports how many jobs are ahead of it', () => {
  add(photo(1))
  const id = c.addCompressJob(db, { type: 'video', key: raw(2, 'mov'), name: 'IMG_2.MOV' })
  expect(c.takeJob(db, id, BASE)).toMatchObject({ status: 'queued', ahead: 1 })
  const first = c.claimJob(db)!
  expect(c.takeJob(db, id, BASE)).toMatchObject({ status: 'queued', ahead: 1 })
  c.failJob(db, first.id, 'Failed')
  expect(c.takeJob(db, id, BASE)).toMatchObject({ status: 'queued', ahead: 0 })
})
