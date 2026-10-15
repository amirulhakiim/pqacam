type Event =
  | { type: 'visit' }
  | { type: 'chat' }
  | { type: 'view'; productId: number }
  | { type: 'search'; term: string; results: number }

// sendBeacon still delivers when the tap opens another app, such as WhatsApp. A lost event only makes a count lower.
export function track(e: Event) {
  try {
    const body = JSON.stringify(e)
    if (!navigator.sendBeacon?.('/api/event', body)) void fetch('/api/event', { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // Tracking never breaks the page.
  }
}
