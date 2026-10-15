export const PLATFORMS = ['shopee', 'tiktok', 'whatsapp'] as const
export type Platform = (typeof PLATFORMS)[number]
export const isPlatform = (v: string): v is Platform => (PLATFORMS as readonly string[]).includes(v)

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string) => ({ ok: false, error }) as const

export type MediaInput = { type: 'photo' | 'video'; key: string }
// id is set for a link that already exists, so its click count is kept.
export type LinkInput = { id?: number; platform: Platform; label: string; url: string }
export type ProductInput = {
  id?: number
  name: string
  categoryId: number
  price: string
  review: string
  links: LinkInput[]
  hidden: boolean
  media: MediaInput[]
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const MEDIA_KEY = { photo: new RegExp(`^photo/${UUID}\\.jpg$`), video: new RegExp(`^video/${UUID}\\.(mp4|webm|mov)$`) }
export const AVATAR_KEY = new RegExp(`^avatar/${UUID}\\.jpg$`)

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Returns the parsed form. It is percent-encoded, so it is safe in a Location header.
function httpsLink(link: string): string | null {
  try {
    const url = new URL(link)
    return url.protocol === 'https:' && url.hostname.includes('.') ? url.href : null
  } catch {
    return null
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
    links: [],
    hidden: r.hidden === true,
    media: [],
  }
  if (!value.name) return fail('Give your product a name.')
  for (const l of Array.isArray(r.links) ? r.links.slice(0, 30) : []) {
    const url = text(l?.url, 2000)
    if (!url || !isPlatform(String(l?.platform))) continue
    const href = httpsLink(url)
    if (!href) return fail('Links must start with https://')
    value.links.push({ id: Number.isInteger(l.id) ? l.id : undefined, platform: l.platform, label: text(l.label, 60), url: href })
  }
  if (!value.links.length) return fail('Add at least one Shopee, TikTok or WhatsApp link.')
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

export type UploadKind = 'photo' | 'video' | 'avatar' | 'raw'
const MB = 1024 * 1024
export const VIDEO_MAX_MB = 50
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const UPLOAD: Record<UploadKind, { max: number; types: Record<string, string> }> = {
  // An original for the watermark worker. Photos arrive already resized to JPEG by the browser.
  raw: { max: 1024 * MB, types: { 'image/jpeg': 'jpg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' } },
  photo: { max: 2 * MB, types: { 'image/jpeg': 'jpg' } },
  avatar: { max: 2 * MB, types: { 'image/jpeg': 'jpg' } },
  video: { max: VIDEO_MAX_MB * MB, types: { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' } },
}

export function validateUpload(raw: unknown): Result<{ kind: UploadKind; contentType: string; size: number; ext: string }> {
  const r = (raw ?? {}) as Record<string, unknown>
  const rule = UPLOAD[r.kind as UploadKind]
  if (!rule) return fail('This file type is not supported.')
  const ext = rule.types[r.contentType as string]
  if (!ext) return fail(r.kind === 'video' ? 'Use an MP4, WebM or MOV video.' : 'This file type is not supported.')
  const size = r.size as number
  if (!Number.isInteger(size) || size <= 0) return fail('This file is empty.')
  if (size > rule.max) {
    return fail(r.kind === 'raw' ? 'Files can be 1 GB at most.' : r.kind === 'video' ? 'Videos can be 50 MB at most.' : 'This photo is too large.')
  }
  return { ok: true, value: { kind: r.kind as UploadKind, contentType: r.contentType as string, size, ext } }
}

export const BIO_SIZES = ['small', 'medium', 'large'] as const
export type BioSize = (typeof BIO_SIZES)[number]
export const toBioSize = (v: unknown): BioSize => (BIO_SIZES.includes(v as BioSize) ? (v as BioSize) : 'medium')

export const FONTS = ['sans', 'serif', 'mono', 'comic', 'script', 'pacifico'] as const
export const POSITIONS = ['move', 'br', 'bl', 'tr', 'tl', 'c'] as const
export type WatermarkSettings = {
  text: string
  size: number
  opacity: number
  speed: number
  font: (typeof FONTS)[number]
  position: (typeof POSITIONS)[number]
}
export const DEFAULT_WATERMARK: Omit<WatermarkSettings, 'text'> = { size: 6, opacity: 70, speed: 120, font: 'sans', position: 'move' }

const within = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T) => (list.includes(v as T) ? (v as T) : fallback)

export function validateWatermark(raw: unknown): Result<WatermarkSettings> {
  const r = (raw ?? {}) as Record<string, unknown>
  // Line breaks would draw a second line in ffmpeg but not in the preview.
  const value = text(r.text, 100).replace(/\s+/g, ' ')
  if (!value) return fail('Add the watermark text.')
  const d = DEFAULT_WATERMARK
  return {
    ok: true,
    value: {
      text: value,
      size: within(r.size, 2, 25, d.size),
      opacity: within(r.opacity, 10, 100, d.opacity),
      speed: within(r.speed, 40, 400, d.speed),
      font: oneOf(FONTS, r.font, d.font),
      position: oneOf(POSITIONS, r.position, d.position),
    },
  }
}

const RAW_KEY = { photo: new RegExp(`^raw/${UUID}\\.jpg$`), video: new RegExp(`^raw/${UUID}\\.(mp4|webm|mov)$`) }
export type JobInput = { type: 'photo' | 'video'; key: string; name: string }

export function validateJobs(raw: unknown): Result<JobInput[]> {
  const list = Array.isArray(raw) ? raw.slice(0, 200) : []
  const jobs: JobInput[] = []
  for (const j of list) {
    const type = j?.type === 'video' ? 'video' : 'photo'
    if (typeof j?.key !== 'string' || !RAW_KEY[type].test(j.key)) return fail('Upload the file again.')
    jobs.push({ type, key: j.key, name: text(j.name, 200) || 'Untitled' })
  }
  return jobs.length ? { ok: true, value: jobs } : fail('Choose at least one photo or video.')
}

export const RANGES = [7, 30, 90] as const
export type Range = (typeof RANGES)[number]
export const toRange = (v: unknown): Range => (RANGES.includes(v as Range) ? (v as Range) : 30)
