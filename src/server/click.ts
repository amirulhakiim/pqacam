import { recordClick } from './catalog'
import type { Db } from './db'
import { isPlatform } from './validate'

export function resolveClick(db: Db, productId: string, platform: string): string | null {
  if (!/^\d+$/.test(productId) || !isPlatform(platform)) return null
  return recordClick(db, Number(productId), platform)
}
