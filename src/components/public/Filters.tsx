import type { Filter } from '../../lib/filter'
import { PLATFORM_LABEL } from '../../lib/platforms'
import { PLATFORMS } from '../../server/validate'
import { Select } from '../admin/Select'

export type View = 'grid' | 'list'

type Props = {
  filter: Filter
  categories: string[]
  onChange: (patch: Partial<Filter>) => void
  view: View
  onView: (view: View) => void
}

const SHOWN = 3

export function Filters({ filter, categories, onChange, view, onView }: Props) {
  const more = categories.slice(SHOWN)
  const inMore = more.includes(filter.category)
  return (
    <div className="pp-filters">
      <div className="pp-search-row">
        <div className="pp-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input value={filter.q} onChange={(e) => onChange({ q: e.target.value })} placeholder="Search my finds…" aria-label="Search my finds" />
          {filter.q && (
            <button type="button" className="pp-clear" onClick={() => onChange({ q: '' })} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>
        <div className="pp-view">
          <button type="button" aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => onView('grid')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="8" height="8" rx="2" />
              <rect x="13" y="3" width="8" height="8" rx="2" />
              <rect x="3" y="13" width="8" height="8" rx="2" />
              <rect x="13" y="13" width="8" height="8" rx="2" />
            </svg>
          </button>
          <button type="button" aria-pressed={view === 'list'} aria-label="List view" onClick={() => onView('list')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="3" y="4" width="18" height="4" rx="2" />
              <rect x="3" y="10" width="18" height="4" rx="2" />
              <rect x="3" y="16" width="18" height="4" rx="2" />
            </svg>
          </button>
        </div>
      </div>
      <div className="pp-tabs">
        {['All', ...categories.slice(0, SHOWN)].map((c) => (
          <button type="button" key={c} className={c === filter.category ? 'pill pill-on' : 'pill'} onClick={() => onChange({ category: c })}>
            {c}
          </button>
        ))}
        {more.length > 0 && (
          <Select
            value={filter.category}
            options={more.map((c) => ({ value: c, label: c }))}
            onChange={(c) => onChange({ category: c })}
            triggerClassName={inMore ? 'pill pill-on pp-more' : 'pill pp-more'}
            placeholder="More ▾"
            aria-label="More categories"
          />
        )}
      </div>
      <div className="pp-platforms">
        <span>Shop</span>
        {(['all', ...PLATFORMS] as const).map((k) => (
          <button
            type="button"
            key={k}
            className={k === filter.platform ? 'pp-platform pp-platform-on' : 'pp-platform'}
            onClick={() => onChange({ platform: k })}
          >
            <span className={`dot dot-${k}`} />
            {k === 'all' ? 'Any' : PLATFORM_LABEL[k].chip}
          </button>
        ))}
      </div>
    </div>
  )
}
