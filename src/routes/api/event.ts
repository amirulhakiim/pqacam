import { createFileRoute } from '@tanstack/react-router'
import { recordEvent } from '../../server/analytics'
import { getDb } from '../../server/db'

export const Route = createFileRoute('/api/event')({
  server: {
    handlers: {
      // navigator.sendBeacon posts the JSON as text. The answer is always 204, so the page never waits on it or shows an error.
      POST: async ({ request }) => {
        const text = await request.text()
        if (text.length <= 1000) {
          try {
            recordEvent(getDb(), JSON.parse(text))
          } catch {
            // Not JSON: nothing to record.
          }
        }
        return new Response(null, { status: 204 })
      },
    },
  },
})
