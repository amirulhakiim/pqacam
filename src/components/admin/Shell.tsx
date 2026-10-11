import type { ReactNode } from 'react'
import type { AdminData } from '../../server/catalog'
import type { Result } from '../../server/validate'

export type Tab = 'products' | 'categories' | 'profile' | 'admins'
export type Act = (work: Promise<Result<unknown>>, done?: string) => Promise<boolean>
export type TabProps = { data: AdminData; act: Act; flash: (text: string) => void }

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
    ['categories', 'Categories', data.categories.length],
    ['profile', 'Profile', ''],
    ['admins', 'Admin access', data.admins.length],
  ]
  const initial = (me.name || me.email)[0].toUpperCase()
  const name = data.profile.name || 'pqacam'
  return (
    <div className="ad">
      <header className="ad-top">
        <div className="ad-top-row">
          <div className="ad-brand">
            <span className="ad-brand-name">{name}</span>
            <span className="eyebrow">Admin</span>
          </div>
          <a className="btn btn-light ad-view" href="/" target="_blank" rel="noopener">
            View page ↗
          </a>
          <button type="button" className="ad-me" onClick={onSignOut} title="Sign out">
            {initial}
          </button>
        </div>
        <nav className="ad-pills">
          {nav.map(([key, label]) => (
            <button type="button" key={key} className={key === tab ? 'ad-nav ad-nav-on' : 'ad-nav'} onClick={() => onTab(key)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <aside className="ad-side">
        <div className="ad-brand">
          <span className="ad-brand-name">{name}</span>
          <span className="eyebrow">Admin</span>
        </div>
        <nav className="ad-side-nav">
          {nav.map(([key, label, count]) => (
            <button type="button" key={key} className={key === tab ? 'ad-nav ad-nav-on' : 'ad-nav'} onClick={() => onTab(key)}>
              {label}
              <span>{count}</span>
            </button>
          ))}
        </nav>
        <a className="ad-side-link" href="/" target="_blank" rel="noopener">
          View live page ↗
        </a>
        <div className="ad-account">
          <span className="ad-me">{initial}</span>
          <span className="ad-account-text">
            <span>{me.name}</span>
            <span>{me.email}</span>
          </span>
          <button type="button" className="link" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="ad-main">{children}</main>
    </div>
  )
}
