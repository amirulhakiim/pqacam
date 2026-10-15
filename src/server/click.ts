import { recordClick } from './catalog'
import type { Db } from './db'

export function resolveClick(db: Db, linkId: string): string | null {
  if (!/^\d+$/.test(linkId)) return null
  return recordClick(db, Number(linkId))
}
