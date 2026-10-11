import { isAdmin } from './catalog'
import type { Db } from './db'

export type SignIn =
  | { ok: true; email: string; name: string }
  | { ok: false; reason: 'unverified' | 'denied'; email: string }

export function checkSignIn(db: Db, claims: unknown): SignIn {
  const c = (claims ?? {}) as Record<string, unknown>
  const email = typeof c.email === 'string' ? c.email.trim().toLowerCase() : ''
  if (!email || c.email_verified !== true) return { ok: false, reason: 'unverified', email }
  if (!isAdmin(db, email)) return { ok: false, reason: 'denied', email }
  return { ok: true, email, name: typeof c.name === 'string' && c.name ? c.name : email }
}
