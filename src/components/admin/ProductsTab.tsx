import { useState } from 'react'
import { PLATFORM_LABEL } from '../../lib/platforms'
import type { AdminProduct } from '../../server/catalog'
import { moveFn, setHiddenFn } from '../../server/fns'
import { PLATFORMS } from '../../server/validate'
import { ProductDrawer } from './ProductDrawer'
import type { TabProps } from './Shell'

const URL_FIELD = { shopee: 'shopeeUrl', tiktok: 'tiktokUrl', whatsapp: 'whatsappUrl' } as const

export function ProductsTab({ data, act, flash }: TabProps) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null)
  const categoryName = new Map(data.categories.map((c) => [c.id, c.name]))
  const needle = q.trim().toLowerCase()
  const rows = data.products.filter((p) => !needle || `${p.name} ${categoryName.get(p.categoryId)}`.toLowerCase().includes(needle))
  const live = data.products.filter((p) => !p.hidden).length
  const last = data.products.length - 1

  return (
    <>
      <div className="ad-head">
        <div>
          <h2>Products</h2>
          <div className="ad-sub">
            {data.products.length} products · {live} live
          </div>
        </div>
        <div className="ad-head-actions">
          <input className="ad-input ad-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" />
          <button
            type="button"
            className="btn btn-dark btn-round"
            onClick={() => (data.categories.length ? setEditing('new') : flash('Add a category first'))}
          >
            + Add product
          </button>
        </div>
      </div>
      <div className="ad-list ad-list-wide">
        {rows.map((p) => {
          const index = data.products.indexOf(p)
          const cover = p.media.find((m) => m.type === 'photo')
          const photos = p.media.filter((m) => m.type === 'photo').length
          const videos = p.media.length - photos
          const linked = PLATFORMS.filter((k) => p[URL_FIELD[k]])
          return (
            <div className={p.hidden ? 'ad-row ad-row-hidden' : 'ad-row'} key={p.id}>
              <button type="button" className="ad-thumb" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                {cover && <img src={cover.url} alt="" />}
              </button>
              <button type="button" className="ad-row-text" onClick={() => setEditing(p)}>
                <span className="ad-row-name">{p.name}</span>
                <span className="ad-row-meta">
                  <span>{categoryName.get(p.categoryId)}</span>
                  <span>·</span>
                  <span>
                    {photos} photo{photos === 1 ? '' : 's'}
                    {videos ? ` · ${videos} video` : ''}
                  </span>
                  {linked.map((k) => (
                    <span key={k} className={`chip chip-${k}`} title="Taps on this buy button">
                      {PLATFORM_LABEL[k].chip} · {p.clicks[k]}
                    </span>
                  ))}
                  {linked.length === 0 && <span className="chip chip-warn">No buy link</span>}
                </span>
              </button>
              <div className="ad-row-actions">
                <button
                  type="button"
                  className="switch-button"
                  onClick={() =>
                    act(setHiddenFn({ data: { id: p.id, hidden: !p.hidden } }), p.hidden ? 'Now live on your page' : 'Hidden from your page')
                  }
                >
                  <span className={p.hidden ? 'switch' : 'switch switch-on'} />
                  {p.hidden ? 'Hidden' : 'Live'}
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  disabled={index === 0}
                  onClick={() => act(moveFn({ data: { kind: 'product', id: p.id, dir: -1 } }))}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  disabled={index === last}
                  onClick={() => act(moveFn({ data: { kind: 'product', id: p.id, dir: 1 } }))}
                  title="Move down"
                >
                  ↓
                </button>
                <button type="button" className="btn btn-soft" onClick={() => setEditing(p)}>
                  Edit
                </button>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="ad-none">{needle ? `No products match "${q}".` : 'No products yet. Add your first one.'}</div>
        )}
      </div>
      {editing && (
        <ProductDrawer
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          data={data}
          act={act}
          flash={flash}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
