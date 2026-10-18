import { expect, test } from 'bun:test'
import { cleanSource, sourceFrom } from '../src/lib/source'

test('a tagged link wins over the referrer', () => {
  expect(sourceFrom('?p=34&s=Threads', 'https://www.instagram.com/', 'pqacam.com')).toBe('threads')
})

test('known referrers map to a short name', () => {
  expect(sourceFrom('', 'https://l.threads.net/', 'pqacam.com')).toBe('threads')
  expect(sourceFrom('', 'https://www.threads.com/@me', 'pqacam.com')).toBe('threads')
  expect(sourceFrom('', 'https://l.instagram.com/', 'pqacam.com')).toBe('instagram')
  expect(sourceFrom('', 'https://lm.facebook.com/', 'pqacam.com')).toBe('facebook')
  expect(sourceFrom('', 'https://t.co/abc', 'pqacam.com')).toBe('x')
  expect(sourceFrom('', 'https://www.google.com.my/', 'pqacam.com')).toBe('google')
})

test('an unknown referrer keeps its host, and no referrer or our own site is direct', () => {
  expect(sourceFrom('', 'https://www.example.co/x', 'pqacam.com')).toBe('example-co')
  expect(sourceFrom('', '', 'pqacam.com')).toBeNull()
  expect(sourceFrom('', 'https://pqacam.com/?p=1', 'pqacam.com')).toBeNull()
})

test('a source is a short lower case word', () => {
  expect(cleanSource(' TikTok ')).toBe('tiktok')
  expect(cleanSource('a b')).toBeNull()
  expect(cleanSource('x'.repeat(31))).toBeNull()
  expect(cleanSource(5)).toBeNull()
})
