import { expect, test } from 'bun:test'
import { openDb } from '../src/server/db'
import { checkSignIn } from '../src/server/signin'

const db = openDb(':memory:', 'owner@example.com')

test('an allowlisted, verified email signs in, and letter case is ignored', () => {
  expect(checkSignIn(db, { email: 'Owner@Example.com', email_verified: true, name: 'Owner' })).toEqual({
    ok: true,
    email: 'owner@example.com',
    name: 'Owner',
  })
})

test('the email is used as the name when Google sends no name', () => {
  expect(checkSignIn(db, { email: 'owner@example.com', email_verified: true })).toMatchObject({ name: 'owner@example.com' })
})

test('an email that is not in the allowlist is denied', () => {
  expect(checkSignIn(db, { email: 'guest@example.com', email_verified: true })).toEqual({
    ok: false,
    reason: 'denied',
    email: 'guest@example.com',
  })
})

test('an unverified email is refused, also when it is in the allowlist', () => {
  expect(checkSignIn(db, { email: 'owner@example.com', email_verified: false })).toMatchObject({ ok: false, reason: 'unverified' })
  expect(checkSignIn(db, { email: 'owner@example.com' })).toMatchObject({ ok: false, reason: 'unverified' })
})

test('claims with no email are refused', () => {
  expect(checkSignIn(db, null)).toMatchObject({ ok: false })
  expect(checkSignIn(db, { email_verified: true })).toMatchObject({ ok: false })
})
