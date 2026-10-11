import { expect, test } from 'bun:test'
import { newKey, presignPut } from '../src/server/r2'
import { validateProduct } from '../src/server/validate'

Object.assign(process.env, {
  R2_ACCOUNT_ID: 'acc',
  R2_ACCESS_KEY_ID: 'id',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'bucket',
})

test('a new key passes product validation', () => {
  const key = newKey('photo', 'jpg')
  const result = validateProduct({ name: 'A', categoryId: 1, shopeeUrl: 'https://a.com', media: [{ type: 'photo', key }] })
  expect(result.ok).toBe(true)
})

test('the presigned URL signs the type and the size and expires in 5 minutes', async () => {
  const url = new URL(await presignPut('photo/x.jpg', 'image/jpeg', 1234))
  expect(url.origin + url.pathname).toBe('https://acc.r2.cloudflarestorage.com/bucket/photo/x.jpg')
  expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
  expect(url.searchParams.get('X-Amz-Expires')).toBe('300')
  expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
})
