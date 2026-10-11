// @ts-expect-error the built output has no type declarations
import handler from './dist/server/server.js'

const CLIENT = './dist/client'

Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(request) {
    const path = new URL(request.url).pathname
    if (path !== '/' && !path.includes('..')) {
      const file = Bun.file(CLIENT + path)
      if (await file.exists()) {
        // Vite puts a content hash in each name under /assets, so those files never change.
        const cache = path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
        return new Response(file, { headers: { 'Cache-Control': cache } })
      }
    }
    return handler.fetch(request)
  },
})

console.log(`pqacam listening on port ${process.env.PORT ?? 3000}`)
