import { createFileRoute } from '@tanstack/react-router'
import { decodeIdToken } from 'arctic'
import { appSession, google } from '../../../../server/auth'
import { getDb } from '../../../../server/db'
import { checkSignIn } from '../../../../server/signin'

const go = (to: string) => new Response(null, { status: 302, headers: { Location: to } })

export const Route = createFileRoute('/api/auth/google/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams
        const session = await appSession()
        const { oauthState, oauthVerifier } = session.data
        const code = params.get('code')
        if (!code || !oauthState || !oauthVerifier || params.get('state') !== oauthState) {
          await session.clear()
          return go('/admin/login?failed=1')
        }
        let claims: unknown
        try {
          const tokens = await google().validateAuthorizationCode(code, oauthVerifier)
          claims = decodeIdToken(tokens.idToken())
        } catch {
          await session.clear()
          return go('/admin/login?failed=1')
        }
        const result = checkSignIn(getDb(), claims)
        if (!result.ok) {
          await session.clear()
          return go(result.reason === 'denied' ? `/admin/login?denied=${encodeURIComponent(result.email)}` : '/admin/login?failed=1')
        }
        await session.update({ email: result.email, name: result.name, oauthState: undefined, oauthVerifier: undefined })
        return go('/admin')
      },
    },
  },
})
