import type { ReactNode } from 'react'
import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import css from '../styles.css?url'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono&display=swap'

const ICON_VERSION = 2

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'application-name', content: 'Pqacam' },
      { name: 'apple-mobile-web-app-title', content: 'Pqacam' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'theme-color', content: '#f9f4ee' },
    ],
    links: [
      { rel: 'icon', href: `/favicon.ico?v=${ICON_VERSION}`, sizes: '48x48' },
      { rel: 'icon', href: `/favicon.svg?v=${ICON_VERSION}`, type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: `/apple-touch-icon.png?v=${ICON_VERSION}` },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'stylesheet', href: FONTS },
      { rel: 'stylesheet', href: css },
    ],
  }),
  component: () => (
    <Document>
      <Outlet />
    </Document>
  ),
})

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
