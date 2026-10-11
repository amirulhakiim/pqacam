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
