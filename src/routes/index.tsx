import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { Filters } from '../components/public/Filters'
import { Header } from '../components/public/Header'
import { ProductGrid } from '../components/public/ProductGrid'
import { ProductSheet } from '../components/public/ProductSheet'
import { type Filter, filterProducts } from '../lib/filter'
import { useMediaProtection } from '../lib/protect'
import { getPublicPageFn } from '../server/fns'

const NO_FILTER: Filter = { q: '', category: 'All', platform: 'all' }

export const Route = createFileRoute('/')({
  loader: () => getPublicPageFn(),
  head: ({ loaderData }) => {
    const title = loaderData?.profile.name || 'pqacam'
    const description = loaderData?.profile.bio ?? ''
    const image = loaderData?.profile.avatarUrl
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        ...(image ? [{ property: 'og:image', content: image }] : []),
        { name: 'twitter:card', content: 'summary' },
      ],
    }
  },
  component: Home,
})

function Home() {
  const page = Route.useLoaderData()
  const [filter, setFilter] = useState(NO_FILTER)
  const [openId, setOpenId] = useState<number | null>(null)
  const close = useCallback(() => setOpenId(null), [])
  // Mounted with the page, so grid covers are protected before a sheet opens.
  const hidden = useMediaProtection()
  const products = filterProducts(page.products, filter)
  const open = page.products.find((p) => p.id === openId)

  return (
    <div className="pp page-glow">
      <div className="pp-column">
        <Header profile={page.profile} />
        <Filters filter={filter} categories={page.categories} onChange={(patch) => setFilter((f) => ({ ...f, ...patch }))} />
        <ProductGrid products={products} onOpen={setOpenId} />
        {products.length === 0 && (
          <div className="pp-empty">
            <div className="pp-empty-title">Nothing here yet</div>
            <div>
              Try another word, or{' '}
              <button type="button" className="link" onClick={() => setFilter(NO_FILTER)}>
                see all finds
              </button>
              .
            </div>
          </div>
        )}
        <footer className="pp-footer">Some links are affiliate links. Thank you for supporting my little corner ♡</footer>
      </div>
      {open && <ProductSheet key={open.id} product={open} handle={page.profile.handle} hidden={hidden} onClose={close} />}
    </div>
  )
}
