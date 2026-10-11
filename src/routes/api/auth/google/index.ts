import { createFileRoute } from '@tanstack/react-router'
import { generateCodeVerifier, generateState } from 'arctic'
import { appSession, google } from '../../../../server/auth'

export const Route = createFileRoute('/api/auth/google/')({
  server: {
    handlers: {
      GET: async () => {
        const oauthState = generateState()
        const oauthVerifier = generateCodeVerifier()
        await (await appSession()).update({ oauthState, oauthVerifier })
        const url = google().createAuthorizationURL(oauthState, oauthVerifier, ['openid', 'email', 'profile'])
        url.searchParams.set('prompt', 'select_account')
        return new Response(null, { status: 302, headers: { Location: url.toString() } })
      },
    },
  },
})
