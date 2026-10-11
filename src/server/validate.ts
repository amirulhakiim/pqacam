export const PLATFORMS = ['shopee', 'tiktok', 'whatsapp'] as const
export type Platform = (typeof PLATFORMS)[number]
export const isPlatform = (v: string): v is Platform => (PLATFORMS as readonly string[]).includes(v)

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string) => ({ ok: false, error }) as const

export type MediaInput = { type: 'photo' | 'video'; key: string }
export type ProductInput = {
  id?: number
  name: string
  categoryId: number
  price: string
  review: string
  shopeeUrl: string
  tiktokUrl: string
  whatsappUrl: string
  hidden: boolean
  media: MediaInput[]
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const MEDIA_KEY = { photo: new RegExp(`^photo/${UUID}\\.jpg$`), video: new RegExp(`^video/${UUID}\\.(mp4|webm|mov)$`) }
export const AVATAR_KEY = new RegExp(`^avatar/${UUID}\\.jpg$`)

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function isHttps(link: string) {
  try {
    const url = new URL(link)
    return url.protocol === 'https:' && url.hostname.includes('.')
  } catch {
    return false
  }
}

export function validateProduct(raw: unknown): Result<ProductInput> {
  if (!raw || typeof raw !== 'object') return fail('Give your product a name.')
  const r = raw as Record<string, unknown>
  const value: ProductInput = {
    id: Number.isInteger(r.id) ? (r.id as number) : undefined,
    name: text(r.name, 200),
    categoryId: Number.isInteger(r.categoryId) ? (r.categoryId as number) : 0,
    price: text(r.price, 40),
    review: text(r.review, 5000),
    shopeeUrl: text(r.shopeeUrl, 2000),
    tiktokUrl: text(r.tiktokUrl, 2000),
    whatsappUrl: text(r.whatsappUrl, 2000),
    hidden: r.hidden === true,
    media: [],
  }
  if (!value.name) return fail('Give your product a name.')
  const links = [value.shopeeUrl, value.tiktokUrl, value.whatsappUrl].filter(Boolean)
  if (!links.length) return fail('Add at least one Shopee, TikTok or WhatsApp link.')
  if (!links.every(isHttps)) return fail('Links must start with https://')
  for (const m of Array.isArray(r.media) ? r.media.slice(0, 20) : []) {
    const type = m?.type === 'video' ? 'video' : 'photo'
    if (typeof m?.key !== 'string' || !MEDIA_KEY[type].test(m.key)) return fail('Upload the file again.')
    value.media.push({ type, key: m.key })
  }
  return { ok: true, value }
}

export function validateEmail(raw: unknown): Result<string> {
  const email = text(raw, 254).toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? { ok: true, value: email } : fail('Enter a valid Google email')
}

export type UploadKind = 'photo' | 'video' | 'avatar'
const MB = 1024 * 1024
const UPLOAD: Record<UploadKind, { max: number; types: Record<string, string> }> = {
  photo: { max: 2 * MB, types: { 'image/jpeg': 'jpg' } },
  avatar: { max: 2 * MB, types: { 'image/jpeg': 'jpg' } },
  video: { max: 50 * MB, types: { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' } },
}

export function validateUpload(raw: unknown): Result<{ kind: UploadKind; contentType: string; size: number; ext: string }> {
  const r = (raw ?? {}) as Record<string, unknown>
  const rule = UPLOAD[r.kind as UploadKind]
  if (!rule) return fail('This file type is not supported.')
  const ext = rule.types[r.contentType as string]
  if (!ext) return fail(r.kind === 'video' ? 'Use an MP4, WebM or MOV video.' : 'This file type is not supported.')
  const size = r.size as number
  if (!Number.isInteger(size) || size <= 0) return fail('This file is empty.')
  if (size > rule.max) return fail(r.kind === 'video' ? 'Videos can be 50 MB at most.' : 'This photo is too large.')
  return { ok: true, value: { kind: r.kind as UploadKind, contentType: r.contentType as string, size, ext } }
}
