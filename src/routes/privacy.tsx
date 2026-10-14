import { createFileRoute } from '@tanstack/react-router'
import { getPublicPageFn } from '../server/fns'

const UPDATED = '14 October 2026'

export const Route = createFileRoute('/privacy')({
  loader: async () => (await getPublicPageFn()).profile.name || 'pqacam',
  head: ({ loaderData }) => ({
    meta: [{ title: `Privacy policy · ${loaderData ?? 'pqacam'}` }, { name: 'description', content: 'What this site collects and why.' }],
  }),
  component: Privacy,
})

function Privacy() {
  const name = Route.useLoaderData()
  return (
    <div className="pp page-glow">
      <article className="pp-column legal">
        <a className="legal-back" href="/">
          ← {name}
        </a>
        <h1>Privacy policy</h1>
        <p className="legal-date">Last updated {UPDATED}</p>

        <h2>Visitors</h2>
        <ul>
          <li>This site does not ask for your name, email, or any account.</li>
          <li>This site sets no cookies for visitors and uses no analytics or advertising trackers.</li>
          <li>
            When you tap a buy button, the site adds 1 to a counter for that product and that shop. The counter is a number only. It
            does not record who you are, your IP address, or your device.
          </li>
          <li>
            Photos and videos load from Cloudflare. The server that hosts this site and Cloudflare can keep standard access logs, such
            as IP address, time, and page, to keep the service secure and working.
          </li>
        </ul>

        <h2>Links to other sites</h2>
        <p>
          Buy buttons open Shopee, TikTok Shop, or WhatsApp. Some are affiliate links, so the owner can earn a commission at no extra
          cost to you. Those services have their own privacy policies, and this site does not control what they collect.
        </p>

        <h2>Site administrators</h2>
        <p>
          Administrators sign in with Google. The site receives the Google account email address and name, and uses them only to check
          access and to show who is signed in. The email address of each approved administrator is stored on the server. The name and
          email are kept in an encrypted sign-in cookie for up to 30 days, or until sign-out.
        </p>

        <h2>Sharing and removal</h2>
        <p>
          This site does not sell or share personal data. An administrator can ask the owner to remove their email address from the
          approved list at any time.
        </p>

        <h2>Changes</h2>
        <p>If this policy changes, the date at the top of this page changes too.</p>
      </article>
    </div>
  )
}
