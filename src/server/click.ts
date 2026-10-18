import { cleanSource } from '../lib/source'
import { recordClick } from './catalog'
import type { Db } from './db'

export function resolveClick(db: Db, linkId: string, source: string | null = null): string | null {
  if (!/^\d+$/.test(linkId)) return null
  return recordClick(db, Number(linkId), Date.now(), cleanSource(source))
}
