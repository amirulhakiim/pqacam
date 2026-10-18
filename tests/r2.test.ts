import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { newKey, presignGet, presignPut, streamToFile } from '../src/server/r2'
import { validateProduct } from '../src/server/validate'

Object.assign(process.env, {
  R2_ACCOUNT_ID: 'acc',
  R2_ACCESS_KEY_ID: 'id',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'bucket',
})

test('a new key passes product validation', () => {
  const key = newKey('photo', 'jpg')
  const result = validateProduct({
    name: 'A',
    categoryId: 1,
    links: [{ platform: 'shopee', label: '', url: 'https://a.com' }],
    media: [{ type: 'photo', key }],
  })
  expect(result.ok).toBe(true)
})

test('the presigned URL signs the type and the size and expires in 5 minutes', async () => {
  const url = new URL(await presignPut('photo/x.jpg', 'image/jpeg', 1234))
  expect(url.origin + url.pathname).toBe('https://acc.r2.cloudflarestorage.com/bucket/photo/x.jpg')
  expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
  expect(url.searchParams.get('X-Amz-Expires')).toBe('300')
  expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
})

test('the presigned download URL asks for a download with a safe file name', async () => {
  const url = new URL(await presignGet('video/x.mp4', 'my "clip"/1.mp4'))
  expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="my _clip__1.mp4"')
  expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
})

test('a large R2 response streams completely to disk', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pqacam-r2-'))
  const path = join(dir, 'video.mov')
  const chunk = new Uint8Array(1024 * 1024)
  let sent = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent === 24) return controller.close()
      chunk[0] = sent++
      controller.enqueue(chunk.slice())
    },
  })
  try {
    await streamToFile(body, path)
    expect(Bun.file(path).size).toBe(24 * 1024 * 1024)
    expect(
      new Uint8Array(
        await Bun.file(path)
          .slice(23 * 1024 * 1024, 23 * 1024 * 1024 + 1)
          .arrayBuffer(),
      )[0],
    ).toBe(23)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
