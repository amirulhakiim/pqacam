import type { ReactNode } from 'react'
import type { AdminData } from '../../server/catalog'
import type { Result } from '../../server/validate'

export const TABS = ['products', 'media', 'analytics', 'watermark', 'categories', 'profile', 'admins'] as const
export type Tab = (typeof TABS)[number]
export type Act = (work: Promise<Result<unknown>>, done?: string) => Promise<boolean>
export type TabProps = { data: AdminData; act: Act; flash: (text: string, error?: boolean) => void }

const ICON: Partial<Record<Tab, ReactNode>> = {
  products: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  media: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </>
  ),
  analytics: <path d="M5 20v-8M12 20V5M19 20v-6" />,
  watermark: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
}
const MORE: Tab[] = ['categories', 'profile', 'admins']

type Props = {
  data: AdminData
  me: { email: string; name: string }
  tab: Tab
  onTab: (tab: Tab) => void
  onSignOut: () => void
  children: ReactNode
}

export function Shell({ data, me, tab, onTab, onSignOut, children }: Props) {
  const nav: [Tab, string, number | ''][] = [
    ['products', 'Products', data.products.length],
    ['media', 'Media', data.jobs.filter((j) => j.status === 'done').length],
    ['analytics', 'Analytics', ''],
    ['watermark', 'Watermark', data.jobs.filter((j) => j.status !== 'done').length || ''],
    ['categories', 'Categories', data.categories.length],
    ['profile', 'Profile', ''],
    ['admins', 'Admin access', data.admins.length],
  ]
  const initial = (me.name || me.email)[0].toUpperCase()
  const name = data.profile.name || 'pqacam'
  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-top-row">
          <div className="adm-brand">
            <span className="adm-brand-name">{name}</span>
            <span className="eyebrow">Admin</span>
          </div>
          <a className="btn btn-light adm-view" href="/" target="_blank" rel="noopener">
            View page ↗
          </a>
          <button type="button" className="adm-me" popoverTarget="account-menu" aria-label="Account">
            {initial}
          </button>
          {/* Native popover: closes on a tap outside or on Escape, with no state to keep. */}
          <div id="account-menu" popover="auto" className="adm-menu">
            <span className="adm-menu-name">{me.name}</span>
            <span className="adm-menu-email">{me.email}</span>
            <button type="button" className="btn btn-light" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <nav className="adm-tabbar">
        {nav
          .filter(([key]) => ICON[key])
          .map(([key, label]) => (
            <button type="button" key={key} className={key === tab ? 'adm-tabbar-item adm-tabbar-on' : 'adm-tabbar-item'} onClick={() => onTab(key)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {ICON[key]}
              </svg>
              {label}
            </button>
          ))}
        <button type="button" className={MORE.includes(tab) ? 'adm-tabbar-item adm-tabbar-on' : 'adm-tabbar-item'} popoverTarget="more-menu">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h.01M12 12h.01M19 12h.01" />
          </svg>
          More
        </button>
        <div id="more-menu" popover="auto" className="adm-menu adm-more">
          {nav
            .filter(([key]) => MORE.includes(key))
            .map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={key === tab ? 'adm-nav adm-nav-on' : 'adm-nav'}
                onClick={(e) => {
                  e.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover()
                  onTab(key)
                }}
              >
                {label}
              </button>
            ))}
        </div>
      </nav>
      <aside className="adm-side">
        <div className="adm-brand">
          <span className="adm-brand-name">{name}</span>
          <span className="eyebrow">Admin</span>
        </div>
        <nav className="adm-side-nav">
          {nav.map(([key, label, count]) => (
            <button type="button" key={key} className={key === tab ? 'adm-nav adm-nav-on' : 'adm-nav'} onClick={() => onTab(key)}>
              {label}
              <span>{count}</span>
            </button>
          ))}
        </nav>
        <a className="adm-side-link" href="/" target="_blank" rel="noopener">
          View live page ↗
        </a>
        <div className="adm-account">
          <span className="adm-me">{initial}</span>
          <span className="adm-account-text">
            <span>{me.name}</span>
            <span>{me.email}</span>
          </span>
          <button type="button" className="link" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  )
}
