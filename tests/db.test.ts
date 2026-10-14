import { expect, test } from 'bun:test'
import { openDb } from '../src/server/db'
import { admin, profile } from '../src/server/schema'

test('a new database has the profile row and the owner as first admin', () => {
  const db = openDb(':memory:', 'Owner@Example.com')
  expect(db.select().from(profile).all()).toHaveLength(1)
  expect(db.select().from(admin).all()).toEqual([{ email: 'owner@example.com' }])
})

test('a new database with no owner has no admin', () => {
  const db = openDb(':memory:')
  expect(db.select().from(admin).all()).toEqual([])
})

test('a database path in a folder that does not exist gives an error that names the path and the fix', () => {
  expect(() => openDb('./no-such-folder/pqacam.db')).toThrow(
    'Cannot open the database at "./no-such-folder/pqacam.db": the folder "./no-such-folder" does not exist. Check DATABASE_PATH. In Docker, do not set it, so the image uses /data/pqacam.db on the volume.',
  )
})
