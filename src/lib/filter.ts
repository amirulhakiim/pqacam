import type { PublicProduct } from '../server/catalog'

export type Filter = { q: string; category: string }

export function filterProducts(products: PublicProduct[], filter: Filter): PublicProduct[] {
  const q = filter.q.trim().toLowerCase()
  return products.filter(
    (p) =>
      (filter.category === 'All' || p.category === filter.category) && (!q || `${p.name} ${p.shortName} ${p.category} ${p.review}`.toLowerCase().includes(q)),
  )
}

export const wrap = (i: number, n: number) => ((i % n) + n) % n
