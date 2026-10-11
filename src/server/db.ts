import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { env } from './env'
import * as schema from './schema'

export function openDb(path: string, ownerEmail?: string) {
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
