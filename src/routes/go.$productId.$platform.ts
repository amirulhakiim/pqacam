import { createFileRoute } from '@tanstack/react-router'
import { resolveClick } from '../server/click'
import { getDb } from '../server/db'

export const Route = createFileRoute('/go/$productId/$platform')({
  server: {
    handlers: {
      // The destination is read from the product row. Nothing in the request can set it.
      GET: ({ params }) => {
        const url = resolveClick(getDb(), params.productId, params.platform)
        if (!url) return new Response('Not found', { status: 404 })
        return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } })
      },
    },
  },
})
