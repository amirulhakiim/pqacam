import { sourceFrom } from './source'

type Event = { type: 'visit' } | { type: 'chat' } | { type: 'view'; productId: number } | { type: 'search'; term: string; results: number }

const landing = typeof window === 'undefined' ? null : { search: window.location.search, referrer: document.referrer, host: window.location.hostname }
const SOURCE_KEY = 'pqacam-source'

export function visitSource(): string | null {
  try {
    const saved = sessionStorage.getItem(SOURCE_KEY)
    if (saved !== null) return saved || null
    const source = landing ? sourceFrom(landing.search, landing.referrer, landing.host) : null
    sessionStorage.setItem(SOURCE_KEY, source ?? '')
    return source
  } catch {
    return landing ? sourceFrom(landing.search, landing.referrer, landing.host) : null
  }
}

export function tagWithSource(a: HTMLAnchorElement) {
  const source = visitSource()
  if (source) a.search = `?s=${encodeURIComponent(source)}`
}

// sendBeacon still delivers when the tap opens another app, such as WhatsApp. A lost event only makes a count lower.
export function track(e: Event) {
  try {
    const body = JSON.stringify({ ...e, source: visitSource() })
    if (!navigator.sendBeacon?.('/api/event', body)) void fetch('/api/event', { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // Tracking never breaks the page.
  }
}
