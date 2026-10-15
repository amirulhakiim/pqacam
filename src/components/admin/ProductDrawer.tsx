import { useEffect, useRef, useState } from 'react'
import { mediaSizeError } from '../../lib/mediaSelection'
import { PLATFORM_LABEL } from '../../lib/platforms'
import type { AdminProduct } from '../../server/catalog'
import { deleteProductFn, saveProductFn } from '../../server/fns'
import { PLATFORMS, type Platform, type ProductInput, validateProduct, VIDEO_TYPES } from '../../server/validate'
import { VideoThumb } from '../VideoThumb'
import { LibraryPicker } from './LibraryPicker'
import type { TabProps } from './Shell'
import type { ProductUploadRequest } from './useProductUploads'

type Props = TabProps & { product: AdminProduct | null; onClose: () => void; onQueue: (request: ProductUploadRequest) => void }
// k is a React key. A new link has no id until it is saved.
type DraftLink = { k: string; id?: number; platform: Platform; label: string; url: string }
type ReadyMedia = AdminProduct['media'][number]
type PendingMedia = { type: 'photo' | 'video'; key: string; url: string; file: File }
type DraftMedia = ReadyMedia | PendingMedia
type Draft = Omit<AdminProduct, 'id' | 'links' | 'media'> & { id?: number; links: DraftLink[]; media: DraftMedia[] }
const pending = (media: DraftMedia): media is PendingMedia => 'file' in media

const emptyLink = (platform: Platform): DraftLink => ({ k: crypto.randomUUID(), platform, label: '', url: '' })
const PLACEHOLDER = { shopee: 'https://shopee.com.my/…', tiktok: 'https://www.tiktok.com/…', whatsapp: 'https://wa.me/…' }

export function ProductDrawer({ product, data, act, flash, onClose, onQueue }: Props) {
  const [draft, setDraft] = useState<Draft>(() => {
    const links: DraftLink[] = (product?.links ?? []).map(({ clicks, ...l }) => ({ ...l, k: String(l.id) }))
    for (const k of PLATFORMS) if (!links.some((l) => l.platform === k)) links.push(emptyLink(k))
    return {
      ...(product ?? { name: '', categoryId: data.categories[0].id, price: '', review: '', hidden: false, media: [] }),
      links,
    }
  })
  const [bigReview, setBigReview] = useState(false)
  const [picking, setPicking] = useState(false)
  // The ref is read on each pointer move, before React renders again. The state only styles the tile.
  const dragFrom = useRef<number | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [savingState, setSavingState] = useState(false)
  const [error, setError] = useState('')
  const [mediaError, setMediaError] = useState('')
  const objectUrls = useRef(new Set<string>())
  useEffect(
    () => {
      return () => {
        for (const url of objectUrls.current) URL.revokeObjectURL(url)
      }
    },
    [],
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  // A ref, not state: a second tap arrives before React renders again.
  const saving = useRef(false)
  const set = (patch: Partial<Draft>) => {
    if (saving.current) return
    setDraft((d) => ({ ...d, ...patch }))
    setError('')
  }
  const close = () => {
    if (!saving.current) onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (bigReview ? setBigReview(false) : close())
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, bigReview])

  // Shown under the tiles and as a toast: the error box at the end of the drawer is out of sight while adding media.
  function fail(message: string) {
    setMediaError(message)
    flash(message)
  }

  function addFiles(type: 'photo' | 'video', files: FileList | null) {
    setMediaError('')
    for (const file of Array.from(files ?? [])) {
      try {
        if (saving.current) throw new Error('Wait until the product finishes saving.')
        if (type === 'video' && !VIDEO_TYPES.includes(file.type)) throw new Error(`${file.name} is not an MP4, WebM or MOV video.`)
        const sizeError = mediaSizeError(file, type)
        if (sizeError) throw new Error(sizeError)
        const url = URL.createObjectURL(file)
        objectUrls.current.add(url)
        setDraft((d) => ({ ...d, media: [...d.media, { type, key: `pending:${crypto.randomUUID()}`, url, file }] }))
      } catch (error) {
        fail(error instanceof Error ? error.message : `Could not read ${file.name}.`)
      }
    }
  }

  function moveMedia(from: number, to: number) {
    if (saving.current) return
    setDraft((d) => {
      const media = d.media.slice()
      media.splice(to, 0, ...media.splice(from, 1))
      return { ...d, media }
    })
  }

  const endDrag = () => {
    dragFrom.current = null
    setDragKey(null)
  }

  // Pointer events, not HTML drag and drop: those do not fire for touch on most phones.
  function dragOver(e: React.PointerEvent) {
    if (saving.current || dragFrom.current === null) return
    const tile = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-index]')
    const to = Number(tile?.dataset.index)
    if (!tile || to === dragFrom.current) return
    moveMedia(dragFrom.current, to)
    dragFrom.current = to
  }

  const setLink = (k: string, patch: Partial<DraftLink>) => set({ links: draft.links.map((l) => (l.k === k ? { ...l, ...patch } : l)) })

  function useMyNumber(k: string) {
    const number = data.profile.whatsapp
    if (!number) return flash('Add your WhatsApp number in Profile first')
    const message = encodeURIComponent(`Hi! I'd like to order the ${draft.name || 'item'}`)
    setLink(k, { url: `https://wa.me/${number}?text=${message}` })
  }

  async function save() {
    if (saving.current) return
    saving.current = true
    setSavingState(true)
    setError('')
    setMediaError('')
    try {
      const fields: ProductInput = {
        id: draft.id,
        name: draft.name,
        categoryId: draft.categoryId,
        price: draft.price,
        review: draft.review,
        hidden: draft.hidden,
        links: draft.links.map(({ k, ...l }) => l),
        media: [],
      }
      const ready = (items: DraftMedia[]) => items.filter((m): m is ReadyMedia => !pending(m)).map(({ type, key }) => ({ type, key }))
      const selected = draft.media.filter(pending)
      const finalInput = { ...fields, media: ready(draft.media) }
      if (draft.media.length > 20) return setError('A product can have at most 20 photos and videos.')
      const valid = validateProduct(finalInput)
      if (!valid.ok) return setError(valid.error)
      if (selected.length) {
        const first = await saveProductFn({ data: {
          ...fields,
          hidden: product ? draft.hidden : true,
          media: product ? product.media.map(({ type, key }) => ({ type, key })) : [],
        } })
        if (!first.ok) return setError(first.error)
        onQueue({
          productId: first.value,
          name: draft.name,
          input: { ...finalInput, id: first.value },
          media: draft.media.map((item) => pending(item) ? { type: item.type, key: item.key, file: item.file } : { type: item.type, key: item.key }),
        })
        onClose()
        void act(Promise.resolve(first), 'Product saved. Media uploading in the background.')
        return
      }
      const result = await saveProductFn({ data: finalInput })
      if (!result.ok) return setError(result.error)
      if (await act(Promise.resolve(result), product ? 'Changes saved' : 'Product added')) onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save. Check your connection and try again.')
    } finally {
      saving.current = false
      setSavingState(false)
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true)
    if (await act(deleteProductFn({ data: draft.id! }), 'Product deleted')) onClose()
  }

  return (
    <div className="adm-backdrop" onClick={close}>
      <div className="adm-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="adm-drawer-head">
          <h3>{product ? 'Edit product' : 'New product'}</h3>
          <button type="button" className="adm-x" onClick={close} aria-label="Close" disabled={savingState}>
            ✕
          </button>
        </div>
        <div className="adm-drawer-body">
          <div className="adm-field">
            <span className="adm-label">
              Photos &amp; videos <em>Drag to reorder. First photo is the cover</em>
            </span>
            <div className="adm-media">
              {draft.media.map((m, i) => (
                <div
                  className={dragKey === m.key ? 'adm-tile adm-tile-drag adm-tile-dragging' : 'adm-tile adm-tile-drag'}
                  key={m.key}
                  data-index={i}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return
                    dragFrom.current = i
                    setDragKey(m.key)
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }}
                  onPointerMove={dragOver}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {m.type === 'photo' ? <img src={m.url} alt="" draggable={false} /> : <VideoThumb url={m.url} />}
                  {m.type === 'video' && !pending(m) && <span className="adm-tile-tag">▶ Video</span>}
                  {pending(m) && <span className="adm-tile-tag">Selected</span>}
                  <button
                    type="button"
                    className="adm-tile-button adm-tile-remove"
                    disabled={savingState}
                    onClick={() => {
                      if (pending(m)) {
                        objectUrls.current.delete(m.url)
                        URL.revokeObjectURL(m.url)
                      }
                      set({ media: draft.media.filter((_, j) => j !== i) })
                    }}
                    title="Remove"
                  >
                    ✕
                  </button>
                  {i > 0 && (
                    <button type="button" className="adm-tile-button adm-tile-left" onClick={() => moveMedia(i, i - 1)} title="Move earlier" disabled={savingState}>
                      ←
                    </button>
                  )}
                </div>
              ))}
              <label className="adm-tile adm-tile-add">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="8.5" cy="9" r="1.5" />
                  <path d="m4 17 5-5 4 4 3-3 4 4" />
                </svg>
                Add photos
                <input type="file" accept="image/*" multiple hidden disabled={savingState} onChange={(e) => (addFiles('photo', e.target.files), (e.target.value = ''))} />
              </label>
              <label className="adm-tile adm-tile-add">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4" />
                  <path d="m10 9 4 3-4 3z" />
                </svg>
                Add videos
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  multiple
                  hidden
                  disabled={savingState}
                  onChange={(e) => (addFiles('video', e.target.files), (e.target.value = ''))}
                />
              </label>
              <button type="button" className="adm-tile adm-tile-add" onClick={() => setPicking(true)} disabled={savingState}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="7" width="15" height="14" rx="2" />
                  <path d="M6 7V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1" />
                  <path d="m5 17 4-4 3 3 2-2 3 3" />
                </svg>
                From library
              </button>
            </div>
            {draft.media.some(pending) && !savingState && <span className="adm-hint">Selected files upload when you save this product.</span>}
            {mediaError && <div className="error-box">{mediaError}</div>}
            {picking && (
              <LibraryPicker
                jobs={data.jobs}
                folders={data.folders}
                taken={draft.media.map((m) => m.key)}
                onPick={(j) => set({ media: [...draft.media, { type: j.type, key: j.key, url: j.url! }] })}
                onClose={() => setPicking(false)}
              />
            )}
          </div>

          <label className="adm-field">
            <span className="adm-label">Product name</span>
            <input className="adm-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ribbed Glass Tumbler Set" />
          </label>

          <div className="adm-two">
            <label className="adm-field">
              <span className="adm-label">Category</span>
              <select className="adm-input" value={draft.categoryId} onChange={(e) => set({ categoryId: Number(e.target.value) })}>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span className="adm-label">
                Price <em>(optional)</em>
              </span>
              <input className="adm-input" value={draft.price} onChange={(e) => set({ price: e.target.value })} placeholder="RM 24.90" />
            </label>
          </div>

          <div className={bigReview ? 'adm-field adm-field-full' : 'adm-field'}>
            <span className="adm-label">
              My honest review
              <span className="adm-grow" />
              <em>{draft.review.length} characters</em>
              <button type="button" className="btn btn-light btn-small" onClick={() => setBigReview(!bigReview)}>
                {bigReview ? 'Done' : 'Expand'}
              </button>
            </span>
            <textarea
              className="adm-input"
              rows={5}
              value={draft.review}
              onChange={(e) => set({ review: e.target.value })}
              placeholder="What you love, what to watch out for, any tips…"
              aria-label="My honest review"
              autoFocus={bigReview}
              key={String(bigReview)}
            />
          </div>

          <div className="adm-field">
            <span className="adm-label">
              Where to buy <em>Leave blank to hide a button</em>
            </span>
            {PLATFORMS.map((platform) => (
              <div className="adm-link-group" key={platform}>
                <span className={`chip chip-${platform} adm-link-chip`}>{PLATFORM_LABEL[platform].chip}</span>
                {draft.links
                  .filter((l) => l.platform === platform)
                  .map((l) => (
                    <div className="adm-link-row" key={l.k}>
                      <input
                        className="adm-input adm-link-label"
                        value={l.label}
                        onChange={(e) => setLink(l.k, { label: e.target.value })}
                        placeholder="Label, e.g. Size M"
                        maxLength={60}
                      />
                      <input
                        className="adm-input"
                        value={l.url}
                        onChange={(e) => setLink(l.k, { url: e.target.value })}
                        placeholder={PLACEHOLDER[platform]}
                        inputMode="url"
                      />
                      {platform === 'whatsapp' && (
                        <button type="button" className="btn btn-light" onClick={() => useMyNumber(l.k)}>
                          Use my number
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => set({ links: draft.links.filter((x) => x.k !== l.k) })}
                        title="Remove link"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                <button type="button" className="link adm-link-add" onClick={() => set({ links: [...draft.links, emptyLink(platform)] })}>
                  + Add {PLATFORM_LABEL[platform].chip} link
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="switch-button" onClick={() => set({ hidden: !draft.hidden })}>
            <span className={draft.hidden ? 'switch' : 'switch switch-on'} />
            Show on my page
          </button>

          {error && <div className="error-box">{error}</div>}
        </div>
        <div className="adm-drawer-foot">
          {product && (
            <button type="button" className={confirmDelete ? 'btn btn-danger btn-danger-on' : 'btn btn-danger'} onClick={remove} disabled={savingState}>
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </button>
          )}
          <span className="adm-grow" />
          <button type="button" className="btn btn-light" onClick={close} disabled={savingState}>
            Cancel
          </button>
          <button type="button" className="btn btn-dark" onClick={save} disabled={savingState}>
            {savingState ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
