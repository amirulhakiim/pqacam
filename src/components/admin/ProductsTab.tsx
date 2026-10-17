import { useRef, useState } from 'react'
import { PLATFORM_LABEL } from '../../lib/platforms'
import type { AdminProduct } from '../../server/catalog'
import { reorderProductsFn, setHiddenFn } from '../../server/fns'
import { PLATFORMS } from '../../server/validate'
import { VideoThumb } from '../VideoThumb'
import { ProductDrawer } from './ProductDrawer'
import type { ProductUploads } from './useProductUploads'
import type { TabProps } from './Shell'
import { BackToTop } from '../BackToTop'

export function ProductsTab({ data, act, flash, uploads }: TabProps & { uploads: ProductUploads }) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null)
  const categoryName = new Map(data.categories.map((c) => [c.id, c.name]))
  const needle = q.trim().toLowerCase()
  // The order while a drag runs, before it is saved. null shows the order from the server.
  const [order, setOrder] = useState<number[] | null>(null)
  const dragFrom = useRef<number | null>(null)
  const byId = new Map(data.products.map((p) => [p.id, p]))
  const sorted = order ? order.flatMap((id) => byId.get(id) ?? []) : data.products
  const rows = sorted.filter((p) => !needle || `${p.name} ${categoryName.get(p.categoryId)}`.toLowerCase().includes(needle))
  const live = data.products.filter((p) => !p.hidden).length
  const ids = () => order ?? data.products.map((p) => p.id)

  function move(from: number, to: number) {
    const next = ids().slice()
    next.splice(to, 0, ...next.splice(from, 1))
    setOrder(next)
    return next
  }

  async function save(next: number[]) {
    await act(reorderProductsFn({ data: next }))
    setOrder(null)
  }

  // Pointer events, not HTML drag and drop: those do not fire for touch on most phones.
  function dragOver(e: React.PointerEvent) {
    if (dragFrom.current === null) return
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-row]')
    const to = Number(row?.dataset.row)
    if (!row || to === dragFrom.current) return
    move(dragFrom.current, to)
    dragFrom.current = to
  }

  function endDrag() {
    if (dragFrom.current === null) return
    dragFrom.current = null
    if (order) save(order)
  }

  return (
    <>
      <BackToTop />
      <div className="adm-head">
        <div>
          <h2>Products</h2>
          <div className="adm-sub">
            {data.products.length} products · {live} live
          </div>
        </div>
        <div className="adm-head-actions">
          <input className="adm-input adm-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" />
          <button
            type="button"
            className="btn btn-dark btn-round"
            onClick={() => (data.categories.length ? setEditing('new') : flash('Add a category first'))}
          >
            + Add product
          </button>
        </div>
      </div>
      <div className="adm-list adm-list-wide">
        {needle && rows.length > 1 && <div className="adm-sub">Clear the search to drag products into a new order.</div>}
        {rows.map((p) => {
          const upload = [...uploads.tasks].reverse().find((task) => task.productId === p.id)
          const uploading = upload?.status === 'queued' || upload?.status === 'running'
          const pendingUpload = uploading || upload?.status === 'failed'
          const index = sorted.indexOf(p)
          const cover = p.media.find((m) => m.type === 'photo')
          const firstVideo = cover ? undefined : p.media.find((m) => m.type === 'video')
          const photos = p.media.filter((m) => m.type === 'photo').length
          const videos = p.media.length - photos
          const linked = PLATFORMS.filter((k) => p.links.some((l) => l.platform === k))
          return (
            <div
              className={['adm-row', p.hidden && !uploading && 'adm-row-hidden', uploading && 'adm-row-uploading', order && dragFrom.current === index && 'adm-row-dragging'].filter(Boolean).join(' ')}
              key={p.id}
              data-row={index}
            >
              {!needle && (
                <button
                  type="button"
                  className="adm-handle"
                  aria-label={`Move ${p.name}. Drag, or use the arrow keys`}
                  title="Drag to reorder"
                  onPointerDown={(e) => {
                    dragFrom.current = index
                    setOrder(ids())
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }}
                  onPointerMove={dragOver}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onKeyDown={(e) => {
                    const to = index + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0)
                    if (to === index || to < 0 || to >= sorted.length) return
                    e.preventDefault()
                    save(move(index, to))
                  }}
                >
                  ⠿
                </button>
              )}
              <button type="button" className="adm-thumb" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`} disabled={pendingUpload}>
                {cover && <img src={cover.url} alt="" />}
                {firstVideo && <VideoThumb url={firstVideo.url} />}
              </button>
              <button type="button" className="adm-row-text" onClick={() => setEditing(p)} disabled={pendingUpload}>
                <span className="adm-row-name">{p.name}</span>
                <span className="adm-row-meta">
                  <span>{categoryName.get(p.categoryId)}</span>
                  <span>·</span>
                  <span>
                    {photos} photo{photos === 1 ? '' : 's'}
                    {videos ? ` · ${videos} video` : ''}
                  </span>
                  {linked.map((k) => (
                    <span key={k} className={`chip chip-${k}`} title="Taps on this buy button">
                      {PLATFORM_LABEL[k].chip} · {p.links.reduce((n, l) => n + (l.platform === k ? l.clicks : 0), 0)}
                    </span>
                  ))}
                  {linked.length === 0 && <span className="chip chip-warn">No buy link</span>}
                </span>
                {upload && <span className={`chip adm-upload-chip ${upload.status === 'failed' ? 'chip-warn' : 'chip-tiktok'}`} role="status" title={upload.status === 'failed' ? upload.error : undefined}>
                  {upload.status === 'failed' ? upload.error : `${upload.stage}${upload.progress !== null && upload.status === 'running' ? ` ${Math.round(upload.progress * 100)}%` : ''}`}
                </span>}
              </button>
              <div className="adm-row-actions">
                <button
                  type="button"
                  className="switch-button"
                  disabled={pendingUpload}
                  onClick={() =>
                    act(setHiddenFn({ data: { id: p.id, hidden: !p.hidden } }), p.hidden ? 'Now live on your page' : 'Hidden from your page')
                  }
                >
                  <span className={p.hidden ? 'switch' : 'switch switch-on'} />
                  {p.hidden ? 'Hidden' : 'Live'}
                </button>
                {upload?.status === 'failed' && <button type="button" className="btn btn-soft" onClick={() => uploads.retry(upload.id)}>Retry</button>}
                {upload?.status === 'failed' && <button type="button" className="btn btn-soft" onClick={() => uploads.discard(upload.id)}>Discard</button>}
                <button type="button" className="btn btn-soft" onClick={() => setEditing(p)} disabled={pendingUpload}>
                  Edit
                </button>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="adm-none">{needle ? `No products match "${q}".` : 'No products yet. Add your first one.'}</div>
        )}
      </div>
      {editing && (
        <ProductDrawer
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          data={data}
          act={act}
          flash={flash}
          onQueue={uploads.enqueue}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
