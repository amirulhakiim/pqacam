import { useEffect, useRef, useState } from 'react'
import { resizeImage, uploadFile } from '../../lib/upload'
import { PLATFORM_LABEL } from '../../lib/platforms'
import type { AdminProduct } from '../../server/catalog'
import { compressVideoFn, deleteProductFn, saveProductFn, takeJobFn } from '../../server/fns'
import { PLATFORMS, type Platform, VIDEO_MAX_MB, VIDEO_TYPES } from '../../server/validate'
import { LibraryPicker } from './LibraryPicker'
import type { TabProps } from './Shell'

type Props = TabProps & { product: AdminProduct | null; onClose: () => void }
// k is a React key. A new link has no id until it is saved.
type DraftLink = { k: string; id?: number; platform: Platform; label: string; url: string }
type Draft = Omit<AdminProduct, 'id' | 'links'> & { id?: number; links: DraftLink[] }

const emptyLink = (platform: Platform): DraftLink => ({ k: crypto.randomUUID(), platform, label: '', url: '' })
const PLACEHOLDER = { shopee: 'https://shopee.com.my/…', tiktok: 'https://www.tiktok.com/…', whatsapp: 'https://wa.me/…' }

export function ProductDrawer({ product, data, act, flash, onClose }: Props) {
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
  const [uploads, setUploads] = useState(0)
  const [error, setError] = useState('')
  const [mediaError, setMediaError] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [stage, setStage] = useState('')
  const [notice, setNotice] = useState('')
  // Polling for a compressed video stops when the drawer closes. The video then stays in the Watermark library.
  const open = useRef(true)
  useEffect(
    () => () => {
      open.current = false
    },
    [],
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  // A ref, not state: a second tap arrives before React renders again.
  const saving = useRef(false)
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError('')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (bigReview ? setBigReview(false) : onClose())
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, bigReview])

  // ponytail: a cancelled draft leaves its uploads in R2. Add a sweep of keys with no media row if storage grows.
  // Shown under the tiles and as a toast: the error box at the end of the drawer is out of sight while adding media.
  function fail(message: string) {
    setMediaError(message)
    flash(message)
  }

  const mb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`

  // A video over the limit, or a MOV (usually HEVC from an iPhone, which Android and Windows cannot play), goes to the server.
  // The server makes an MP4 under the limit, and the drawer waits for it.
  async function compress(file: File) {
    setStage(`Uploading ${file.name}`)
    const uploaded = await uploadFile('raw', file, setProgress)
    if (!uploaded.ok) return fail(`${file.name}: ${uploaded.error}`)
    const started = await compressVideoFn({ data: { type: 'video', key: uploaded.value.key, name: file.name } })
    if (!started.ok) return fail(`${file.name}: ${started.error}`)
    setStage(`Compressing ${file.name}`)
    setProgress(0)
    while (open.current) {
      await new Promise((r) => setTimeout(r, 2000))
      const r = await takeJobFn({ data: started.value })
      if (!r.ok) return fail(`${file.name}: ${r.error}`)
      const job = r.value
      if (job.status === 'failed') return fail(`${file.name}: ${job.error}`)
      if (job.status !== 'done' || !('key' in job)) {
        setProgress(job.progress / 100)
        continue
      }
      setDraft((d) => ({ ...d, media: [...d.media, { type: 'video', key: job.key!, url: job.url! }] }))
      if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
        const text = `${file.name} was ${mb(file.size)}, so it was compressed to ${mb(job.bytes ?? 0)} to fit the ${VIDEO_MAX_MB} MB limit.`
        setNotice(text)
        flash(text)
      }
      return
    }
  }

  async function addFiles(type: 'photo' | 'video', files: FileList | null) {
    setMediaError('')
    setNotice('')
    for (const file of Array.from(files ?? [])) {
      if (type === 'video' && !VIDEO_TYPES.includes(file.type)) {
        fail(`${file.name} is not an MP4, WebM or MOV video.`)
        continue
      }
      if (type === 'video' && file.size > 1024 * 1024 * 1024) {
        fail(`${file.name} is ${mb(file.size)}. Videos can be 1 GB at most.`)
        continue
      }
      setUploads((n) => n + 1)
      try {
        if (type === 'video' && (file.size > VIDEO_MAX_MB * 1024 * 1024 || file.type === 'video/quicktime')) {
          await compress(file)
          continue
        }
        setStage(`Uploading ${file.name}`)
        const blob = type === 'photo' ? await resizeImage(file, 1000) : file
        const result = await uploadFile(type, blob, type === 'video' ? setProgress : undefined)
        if (result.ok) setDraft((d) => ({ ...d, media: [...d.media, { type, ...result.value }] }))
        else fail(`${file.name}: ${result.error}`)
      } catch {
        fail(`Could not read ${file.name}.`)
      } finally {
        setUploads((n) => n - 1)
        setProgress(null)
        setStage('')
      }
    }
  }

  function moveMedia(from: number, to: number) {
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
    if (dragFrom.current === null) return
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
    try {
      const input = {
        ...draft,
        media: draft.media.map(({ type, key }) => ({ type, key })),
        links: draft.links.map(({ k, ...l }) => l),
      }
      const result = await saveProductFn({ data: input })
      if (!result.ok) return setError(result.error)
      await act(Promise.resolve(result), product ? 'Changes saved' : 'Product added')
      onClose()
    } catch {
      setError('Could not save. Check your connection and try again.')
    } finally {
      saving.current = false
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true)
    if (await act(deleteProductFn({ data: draft.id! }), 'Product deleted')) onClose()
  }

  return (
    <div className="adm-backdrop" onClick={onClose}>
      <div className="adm-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="adm-drawer-head">
          <h3>{product ? 'Edit product' : 'New product'}</h3>
          <button type="button" className="adm-x" onClick={onClose} aria-label="Close">
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
                  {m.type === 'photo' ? <img src={m.url} alt="" draggable={false} /> : <video src={m.url} muted preload="metadata" />}
                  {m.type === 'video' && <span className="adm-tile-tag">▶ Video</span>}
                  <button
                    type="button"
                    className="adm-tile-button adm-tile-remove"
                    onClick={() => set({ media: draft.media.filter((_, j) => j !== i) })}
                    title="Remove"
                  >
                    ✕
                  </button>
                  {i > 0 && (
                    <button type="button" className="adm-tile-button adm-tile-left" onClick={() => moveMedia(i, i - 1)} title="Move earlier">
                      ←
                    </button>
                  )}
                </div>
              ))}
              <label className="adm-tile adm-tile-add">
                <span>+</span>Add photos
                <input type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles('photo', e.target.files), (e.target.value = ''))} />
              </label>
              <button type="button" className="adm-tile adm-tile-add" onClick={() => setPicking(true)}>
                <span>+</span>From library
              </button>
              <label className="adm-tile adm-tile-add">
                <span>+</span>Add video
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  hidden
                  onChange={(e) => (addFiles('video', e.target.files), (e.target.value = ''))}
                />
              </label>
            </div>
            {uploads > 0 && (
              <span className="adm-hint">
                {stage || `Uploading ${uploads}`}…{progress !== null && ` ${Math.round(progress * 100)}%`}
              </span>
            )}
            {mediaError && <div className="error-box">{mediaError}</div>}
            {notice && <div className="notice-box">{notice}</div>}
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
            <button type="button" className={confirmDelete ? 'btn btn-danger btn-danger-on' : 'btn btn-danger'} onClick={remove}>
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </button>
          )}
          <span className="adm-grow" />
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-dark" onClick={save} disabled={uploads > 0}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
