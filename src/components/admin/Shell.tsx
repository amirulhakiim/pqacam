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
          <button type="button" className="adm-me" onClick={onSignOut} title="Sign out">
            {initial}
          </button>
        </div>
        <nav className="adm-pills">
          {nav.map(([key, label]) => (
            <button type="button" key={key} className={key === tab ? 'adm-nav adm-nav-on' : 'adm-nav'} onClick={() => onTab(key)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
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
