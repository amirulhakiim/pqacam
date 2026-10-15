import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatButton } from '../components/public/ChatButton'
import { Filters } from '../components/public/Filters'
import { Header } from '../components/public/Header'
import { ProductGrid } from '../components/public/ProductGrid'
import { ProductSheet } from '../components/public/ProductSheet'
import { type Filter, filterProducts } from '../lib/filter'
import { useMediaProtection } from '../lib/protect'
import { track } from '../lib/track'
import { getPublicPageFn } from '../server/fns'

const NO_FILTER: Filter = { q: '', category: 'All', platform: 'all' }

// ?p=<id> opens that product, so a product can be shared as a link.
type Search = { p?: number }

export const Route = createFileRoute('/')({
  validateSearch: (raw: Record<string, unknown>): Search => {
    const p = Number(raw.p)
    return Number.isInteger(p) && p > 0 ? { p } : {}
  },
  loader: () => getPublicPageFn(),
  head: ({ loaderData, match }) => {
    const name = loaderData?.profile.name || 'pqacam'
    // A shared product link previews that product: its name, review and first photo.
    const shared = loaderData?.products.find((p) => p.id === match.search.p)
    const title = shared ? `${shared.name} · ${name}` : name
    // A share preview shows one line, so paragraphs are joined.
    const description = ((shared ? shared.review : loaderData?.profile.bio) ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
    const image = (shared && shared.media.find((m) => m.type === 'photo')?.url) || loaderData?.profile.avatarUrl
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
  const router = useRouter()
  const navigate = Route.useNavigate()
  const openId = Route.useSearch().p ?? null
  // True when this page opened the product, so closing can go back one step instead of adding a history entry.
  const openedHere = useRef(false)
  const setOpenId = useCallback(
    (id: number) => {
      openedHere.current = true
      navigate({ search: { p: id }, resetScroll: false })
    },
    [navigate],
  )
  const close = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false
      router.history.back()
    } else navigate({ search: {}, replace: true, resetScroll: false })
  }, [navigate, router])
  // Mounted with the page, so grid covers are protected before a sheet opens.
  const hidden = useMediaProtection()
  const products = filterProducts(page.products, filter)
  const open = page.products.find((p) => p.id === openId)
  const searched = useRef('')

  // One visit for each browser tab session, so a reload is not a second visit.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('pqacam-visit')) return
      sessionStorage.setItem('pqacam-visit', '1')
    } catch {
      // Private mode can refuse storage. Count the visit anyway.
    }
    track({ type: 'visit' })
  }, [])

  useEffect(() => {
    if (openId !== null) track({ type: 'view', productId: openId })
  }, [openId])

  // A search counts once the visitor stops typing, not on each letter.
  const term = filter.q.trim().toLowerCase()
  const found = products.length
  useEffect(() => {
    if (term.length < 2 || term === searched.current) return
    const timer = setTimeout(() => {
      searched.current = term
      track({ type: 'search', term, results: found })
    }, 1500)
    return () => clearTimeout(timer)
  }, [term, found])

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
        <footer className="pp-footer">
          <a href="/privacy">Privacy</a>
        </footer>
      </div>
      {page.profile.whatsapp && <ChatButton number={page.profile.whatsapp} name={page.profile.name} />}
      {open && <ProductSheet key={open.id} product={open} hidden={hidden} onClose={close} />}
    </div>
  )
}
