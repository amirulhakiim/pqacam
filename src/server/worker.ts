import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as catalog from './catalog'
import { type Db, getDb } from './db'
import { deleteObjects, getToFile, newKey, putFile } from './r2'
import { validateWatermark } from './validate'
import { watermarkFile } from './watermark'

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
  try {
    const settings = validateWatermark(JSON.parse(row.settings))
    if (!settings.ok) throw new Error(settings.error)
    await mkdir(dir, { recursive: true })
    await getToFile(row.sourceKey, input)
    await watermarkFile(row.type, input, output, join(dir, 'text.txt'), settings.value, (percent) => {
      if (Date.now() - lastWrite < 2000) return
      lastWrite = Date.now()
      catalog.setJobProgress(db, row.id, percent)
    })
    const key = newKey(row.type, ext)
    await putFile(key, output, row.type === 'video' ? 'video/mp4' : 'image/jpeg')
    catalog.finishJob(db, row.id, key)
    await deleteObjects([row.sourceKey])
  } catch (error) {
    console.error(`Watermark job ${row.id} failed`, error)
    catalog.failJob(db, row.id, 'Could not watermark this file. Try again, or upload it again.')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
