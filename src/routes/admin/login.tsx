import { createFileRoute } from '@tanstack/react-router'
import { getPublicPageFn } from '../../server/fns'

type LoginSearch = { denied?: string; failed?: true }

export const Route = createFileRoute('/admin/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    ...(typeof search.denied === 'string' ? { denied: search.denied } : {}),
    ...(search.failed ? { failed: true as const } : {}),
  }),
  head: () => ({ meta: [{ title: 'Admin sign-in' }, { name: 'robots', content: 'noindex' }] }),
  loader: async () => (await getPublicPageFn()).profile.name,
  component: Login,
})

function Login() {
  const name = Route.useLoaderData()
  const { denied, failed } = Route.useSearch()
  const error = denied
    ? `${denied} does not have admin access. Ask the owner to add it under Admin access.`
    : failed
      ? 'Sign-in did not finish. Try again.'
      : null
  return (
    <div className="login-page page-glow">
      <div className="login-card">
        <div className="eyebrow">Admin</div>
        <h1 className="login-title">{name || 'pqacam'}</h1>
        <p className="login-lead">Sign in to manage your products, reviews and links.</p>
        <a className="login-google" href="/api/auth/google">
          <span className="login-g">G</span>Continue with Google
        </a>
        {error && <div className="error-box">{error}</div>}
        <p className="login-note">Only approved Google accounts can sign in.</p>
      </div>
    </div>
  )
}
