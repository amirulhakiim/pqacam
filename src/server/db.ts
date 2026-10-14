import { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { env } from './env'
import * as schema from './schema'

export function openDb(path: string, ownerEmail?: string) {
  // The folder is not created here: in Docker, a folder outside the volume is erased on each deploy.
  const folder = dirname(path)
  if (path !== ':memory:' && !existsSync(folder)) {
    throw new Error(
      `Cannot open the database at "${path}": the folder "${folder}" does not exist. Check DATABASE_PATH. In Docker, do not set it, so the image uses /data/pqacam.db on the volume.`,
    )
  }
  const sqlite = new Database(path, { create: true })
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: 'drizzle' })
  db.insert(schema.profile).values({ id: 1 }).onConflictDoNothing().run()
  if (ownerEmail && !db.select().from(schema.admin).get()) {
    db.insert(schema.admin).values({ email: ownerEmail.trim().toLowerCase() }).run()
  }
  return db
}

export type Db = ReturnType<typeof openDb>

let instance: Db | undefined

export function getDb(): Db {
  instance ??= openDb(env('DATABASE_PATH'), process.env.OWNER_EMAIL)
  return instance
}
