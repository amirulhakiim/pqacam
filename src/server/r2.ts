import { AwsClient } from 'aws4fetch'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { env } from './env'
import type { UploadKind } from './validate'

const client = () =>
  new AwsClient({
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    service: 's3',
    region: 'auto',
  })

const objectUrl = (key: string) => `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}/${key}`

export const newKey = (kind: UploadKind, ext: string) => `${kind}/${crypto.randomUUID()}.${ext}`

// The type and the size are signed, so R2 refuses a PUT with a different file.
export async function presignPut(key: string, contentType: string, size: number): Promise<string> {
  const url = new URL(objectUrl(key))
  url.searchParams.set('X-Amz-Expires', '300')
  const signed = await client().sign(url.toString(), {
    method: 'PUT',
    headers: { 'content-type': contentType, 'content-length': String(size) },
    aws: { signQuery: true, allHeaders: true },
  })
  return signed.url
}

export async function presignGet(key: string, filename: string): Promise<string> {
  const url = new URL(objectUrl(key))
  url.searchParams.set('X-Amz-Expires', '300')
  url.searchParams.set('response-content-disposition', `attachment; filename="${filename.replace(/[^\w. -]/g, '_')}"`)
  const signed = await client().sign(url.toString(), { method: 'GET', aws: { signQuery: true } })
  return signed.url
}

export async function deleteObjects(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      try {
        const response = await client().fetch(objectUrl(key), { method: 'DELETE' })
        if (!response.ok) console.error(`R2 delete failed for ${key}: ${response.status}`)
      } catch (error) {
        console.error(`R2 delete failed for ${key}`, error)
      }
    }),
  )
}

export async function getToFile(key: string, path: string): Promise<void> {
  const signal = AbortSignal.timeout(10 * 60_000)
  const response = await client().fetch(objectUrl(key), { signal })
  if (!response.ok) throw new Error(`R2 get failed for ${key}: ${response.status}`)
  if (!response.body) throw new Error(`R2 get failed for ${key}: empty response`)
  await streamToFile(response.body, path, signal)
}

export async function streamToFile(body: ReadableStream<Uint8Array>, path: string, signal?: AbortSignal): Promise<void> {
  await pipeline(body, createWriteStream(path), { signal })
}

export async function putFile(key: string, path: string, contentType: string): Promise<void> {
  const response = await client().fetch(objectUrl(key), {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: Bun.file(path),
  })
  if (!response.ok) throw new Error(`R2 put failed for ${key}: ${response.status}`)
}
