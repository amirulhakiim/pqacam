type Shareable = { id: number; name: string; shortName: string; price: string; media: { type: string; url: string }[] }

export const SHARE_WIDTH = 1200
export const SHARE_HEIGHT = 630

export const shareCover = (p: Shareable) => p.media.find((m) => m.type === 'photo')?.url ?? null

export function shareVersion(p: Shareable): string {
  const input = `${shareCover(p)}|${p.shortName || p.name}|${p.price}`
  let hash = 5381
  for (let i = 0; i < input.length; i++) hash = ((hash * 33) ^ input.charCodeAt(i)) >>> 0
  return hash.toString(36)
}

export const sharePath = (p: Shareable) => `/share/${p.id}?v=${shareVersion(p)}`
