import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '../../server/db'
import { profile } from '../../server/schema'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => {
        getDb().select().from(profile).get()
        return Response.json({ ok: true })
      },
    },
  },
})
