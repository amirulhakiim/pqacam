const DEFAULTS = { DATABASE_PATH: '/data/pqacam.db' } as const

export type EnvKey =
  | 'PUBLIC_URL'
  | 'SESSION_SECRET'
  | 'OWNER_EMAIL'
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET'
  | 'R2_ACCOUNT_ID'
  | 'R2_ACCESS_KEY_ID'
  | 'R2_SECRET_ACCESS_KEY'
  | 'R2_BUCKET'
  | 'MEDIA_BASE_URL'
  | 'DATABASE_PATH'

export function env(key: EnvKey): string {
  const value = process.env[key] ?? DEFAULTS[key as keyof typeof DEFAULTS]
  if (!value) throw new Error(`Missing environment variable ${key}`)
  return value.replace(/\/$/, '')
}
