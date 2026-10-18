type Shareable = { id: number; name: string; shortName: string; price: string; media: { type: string; url: string }[] }

export const SHARE_WIDTH = 1200
export const SHARE_HEIGHT = 630
const SHARE_DESIGN = 3

export const shareCover = (p: Shareable) => p.media.find((m) => m.type === 'photo')?.url ?? null

export function shareVersion(p: Shareable): string {
  const input = `${SHARE_DESIGN}|${shareCover(p)}|${p.shortName || p.name}|${p.price}`
  let hash = 5381
  for (let i = 0; i < input.length; i++) hash = ((hash * 33) ^ input.charCodeAt(i)) >>> 0
  return hash.toString(36)
}

export const sharePath = (p: Shareable) => `/share/${p.id}?v=${shareVersion(p)}`

export function previewText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(flat)].map((s) => s.segment)
  return parts.length <= max
    ? flat
    : `${parts
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`
}
