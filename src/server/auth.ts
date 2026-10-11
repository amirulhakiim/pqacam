import { redirect } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { Google } from 'arctic'
import { isAdmin } from './catalog'
import { getDb } from './db'
import { env } from './env'

type SessionData = { email?: string; name?: string; oauthState?: string; oauthVerifier?: string }

export function appSession() {
  return useSession<SessionData>({
    name: 'pqacam',
    password: env('SESSION_SECRET'),
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, sameSite: 'lax', secure: env('PUBLIC_URL').startsWith('https://') },
  })
}

// The allowlist is read on each call, so a removed admin loses access on the next request.
export async function requireAdmin(): Promise<{ email: string; name: string }> {
  const { email, name } = (await appSession()).data
  if (!email || !isAdmin(getDb(), email)) throw redirect({ to: '/admin/login' })
  return { email, name: name ?? email }
}

export function google() {
  return new Google(env('GOOGLE_CLIENT_ID'), env('GOOGLE_CLIENT_SECRET'), `${env('PUBLIC_URL')}/api/auth/google/callback`)
}
