import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as catalog from './catalog'
import { type Db, getDb } from './db'
import { deleteObjects, getToFile, newKey, putFile } from './r2'
import { validateWatermark } from './validate'
import { TooLargeError, watermarkFile } from './watermark'

let running = false
let started = false

// Runs queued jobs one at a time in this process. Safe to call often: a second call while it runs does nothing.
// ponytail: one job at a time. Run several when the server has spare cores.
export function kick() {
  if (running) return
  running = true
  void drain(getDb()).finally(() => {
    running = false
  })
}

async function drain(db: Db) {
  if (!started) {
    started = true
    catalog.requeueStuckJobs(db)
  }
  for (let row = catalog.claimJob(db); row; row = catalog.claimJob(db)) await runJob(db, row)
}

type Row = NonNullable<ReturnType<typeof catalog.claimJob>>

export async function runJob(db: Db, row: Row) {
  const dir = join(tmpdir(), 'pqacam-jobs', String(row.id))
  const ext = row.type === 'video' ? 'mp4' : 'jpg'
  const input = join(dir, `in.${row.sourceKey.split('.').pop()}`)
  const output = join(dir, `out.${ext}`)
  let lastWrite = 0
  const startedAt = Date.now()
  const timing = { queueMs: startedAt - row.createdAt, downloadMs: 0, processMs: 0, uploadMs: 0 }
  console.info('Media job started', { id: row.id, type: row.type, queueMs: timing.queueMs })
  try {
    // A job for a product video compresses only. Its settings hold { compressOnly: true } instead of a watermark.
    const saved = JSON.parse(row.settings)
    const settings = saved.compressOnly ? ({ ok: true, value: null } as const) : validateWatermark(saved)
    if (!settings.ok) throw new Error(settings.error)
    await mkdir(dir, { recursive: true })
    await getToFile(row.sourceKey, input)
    timing.downloadMs = Date.now() - startedAt
    console.info('Media job downloaded', { id: row.id, downloadMs: timing.downloadMs })
    const processStarted = Date.now()
    const bytes = await watermarkFile(row.type, input, output, join(dir, 'text.txt'), settings.value, (percent) => {
      if (Date.now() - lastWrite < 2000) return
      lastWrite = Date.now()
      catalog.setJobProgress(db, row.id, percent)
    })
    timing.processMs = Date.now() - processStarted
    console.info('Media job processed', { id: row.id, processMs: timing.processMs })
    const key = newKey(row.type, ext)
    const uploadStarted = Date.now()
    await putFile(key, output, row.type === 'video' ? 'video/mp4' : 'image/jpeg')
    timing.uploadMs = Date.now() - uploadStarted
    console.info('Media job uploaded', { id: row.id, uploadMs: timing.uploadMs })
    catalog.finishJob(db, row.id, key, bytes)
    await deleteObjects([row.sourceKey])
  } catch (error) {
    console.error(`Watermark job ${row.id} failed`, error)
    catalog.failJob(
      db,
      row.id,
      error instanceof TooLargeError
        ? 'This video is too long to fit 50 MB, even compressed. Trim it and upload it again.'
        : 'Could not process this file. Try again, or upload it again.',
    )
  } finally {
    console.info('Media job timing', { id: row.id, type: row.type, ...timing, elapsedMs: Date.now() - startedAt })
    await rm(dir, { recursive: true, force: true })
  }
}
