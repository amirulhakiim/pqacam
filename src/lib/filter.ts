import type { PublicProduct } from '../server/catalog'
import type { Platform } from '../server/validate'

export type Filter = { q: string; category: string; platform: Platform | 'all' }

export function filterProducts(products: PublicProduct[], filter: Filter): PublicProduct[] {
  const q = filter.q.trim().toLowerCase()
  const { platform } = filter
  return products.filter(
    (p) =>
      (filter.category === 'All' || p.category === filter.category) &&
      (platform === 'all' || p.platforms.includes(platform)) &&
      (!q || `${p.name} ${p.category} ${p.review}`.toLowerCase().includes(q)),
  )
}

export const wrap = (i: number, n: number) => ((i % n) + n) % n
