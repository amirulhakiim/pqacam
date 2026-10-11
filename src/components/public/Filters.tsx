import type { Filter } from '../../lib/filter'
import { PLATFORM_LABEL } from '../../lib/platforms'
import { PLATFORMS } from '../../server/validate'

type Props = { filter: Filter; categories: string[]; onChange: (patch: Partial<Filter>) => void }

export function Filters({ filter, categories, onChange }: Props) {
  return (
    <div className="pp-filters">
      <div className="pp-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <input
          value={filter.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search my finds…"
          aria-label="Search my finds"
        />
        {filter.q && (
          <button type="button" className="pp-clear" onClick={() => onChange({ q: '' })} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>
      <div className="pp-tabs">
        {['All', ...categories].map((c) => (
          <button
            type="button"
            key={c}
            className={c === filter.category ? 'pill pill-on' : 'pill'}
            onClick={() => onChange({ category: c })}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="pp-platforms">
        <span>Shop on</span>
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
