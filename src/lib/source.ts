const KNOWN: [RegExp, string][] = [
  [/(^|\.)threads\.(net|com)$/, 'threads'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, 'x'],
  [/(^|\.)whatsapp\.(com|net)$/, 'whatsapp'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
]

export function cleanSource(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().toLowerCase()
  return /^[a-z0-9_-]{1,30}$/.test(value) ? value : null
}

export function sourceFrom(search: string, referrer: string, ownHost: string): string | null {
  const tagged = cleanSource(new URLSearchParams(search).get('s'))
  if (tagged) return tagged
  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase()
  } catch {
    return null
  }
  if (host === ownHost) return null
  return KNOWN.find(([pattern]) => pattern.test(host))?.[1] ?? cleanSource(host.replace(/^(www|m|l|lm)\./, '').replaceAll('.', '-'))
}

export const sourceLabel = (source: string | null) => source ?? 'direct'
