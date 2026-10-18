import { createFileRoute } from '@tanstack/react-router'
import { shareCover, shareVersion } from '../lib/share'
import { getPublicPage } from '../server/catalog'
import { getDb } from '../server/db'
import { env } from '../server/env'
import { shareImage } from '../server/share'

export const Route = createFileRoute('/share/$productId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const product = getPublicPage(getDb(), env('MEDIA_BASE_URL')).products.find((p) => String(p.id) === params.productId)
        const cover = product && shareCover(product)
        if (!product || !cover) return new Response('Not found', { status: 404 })
        try {
          const path = await shareImage(
            product.id,
            shareVersion(product),
            cover,
            product.shortName || product.name,
            product.price,
            new URL(env('PUBLIC_URL')).host,
          )
          return new Response(Bun.file(path), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } })
        } catch (error) {
          console.error('Share image failed', { id: product.id, error })
          return new Response(null, { status: 302, headers: { Location: cover, 'Cache-Control': 'no-store' } })
        }
      },
    },
  },
})
