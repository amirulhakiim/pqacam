import { useEffect, useRef, useState } from 'react'
import { resizeImage, uploadFile } from '../../lib/upload'
import { PLATFORM_LABEL } from '../../lib/platforms'
import type { AdminProduct } from '../../server/catalog'
import { deleteProductFn, saveProductFn } from '../../server/fns'
import { PLATFORMS } from '../../server/validate'
import type { TabProps } from './Shell'

type Props = TabProps & { product: AdminProduct | null; onClose: () => void }
type Draft = Omit<AdminProduct, 'id' | 'clicks'> & { id?: number }

const URL_FIELD = { shopee: 'shopeeUrl', tiktok: 'tiktokUrl', whatsapp: 'whatsappUrl' } as const
const PLACEHOLDER = { shopee: 'https://shopee.com.my/…', tiktok: 'https://www.tiktok.com/…', whatsapp: 'https://wa.me/…' }

export function ProductDrawer({ product, data, act, flash, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(
    () =>
      product ?? {
        name: '',
        categoryId: data.categories[0].id,
        price: '',
        review: '',
        shopeeUrl: '',
        tiktokUrl: '',
        whatsappUrl: '',
        hidden: false,
        media: [],
      },
  )
  const [uploads, setUploads] = useState(0)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  // A ref, not state: a second tap arrives before React renders again.
  const saving = useRef(false)
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError('')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ponytail: a cancelled draft leaves its uploads in R2. Add a sweep of keys with no media row if storage grows.
  async function addFiles(type: 'photo' | 'video', files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      setUploads((n) => n + 1)
      try {
        const result = await uploadFile(type, type === 'photo' ? await resizeImage(file, 1000) : file)
        if (result.ok) setDraft((d) => ({ ...d, media: [...d.media, { type, ...result.value }] }))
        else setError(result.error)
      } catch {
        setError('Could not read this file.')
      } finally {
        setUploads((n) => n - 1)
      }
    }
  }

  function moveEarlier(i: number) {
    const media = draft.media.slice()
    ;[media[i - 1], media[i]] = [media[i], media[i - 1]]
    set({ media })
  }

  function useMyNumber() {
    const number = data.profile.whatsapp
    if (!number) return flash('Add your WhatsApp number in Profile first')
    const message = encodeURIComponent(`Hi! I'd like to order the ${draft.name || 'item'}`)
    set({ whatsappUrl: `https://wa.me/${number}?text=${message}` })
  }

  async function save() {
    if (saving.current) return
    saving.current = true
    try {
      const input = { ...draft, media: draft.media.map(({ type, key }) => ({ type, key })) }
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
    <div className="ad-backdrop" onClick={onClose}>
      <div className="ad-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="ad-drawer-head">
          <h3>{product ? 'Edit product' : 'New product'}</h3>
          <button type="button" className="ad-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="ad-drawer-body">
          <div className="ad-field">
            <span className="ad-label">
              Photos &amp; videos <em>First photo is the cover</em>
            </span>
            <div className="ad-media">
              {draft.media.map((m, i) => (
                <div className="ad-tile" key={m.key}>
                  {m.type === 'photo' ? <img src={m.url} alt="" /> : <video src={m.url} muted preload="metadata" />}
                  {m.type === 'video' && <span className="ad-tile-tag">▶ Video</span>}
                  <button
                    type="button"
                    className="ad-tile-button ad-tile-remove"
                    onClick={() => set({ media: draft.media.filter((_, j) => j !== i) })}
                    title="Remove"
                  >
                    ✕
                  </button>
                  {i > 0 && (
                    <button type="button" className="ad-tile-button ad-tile-left" onClick={() => moveEarlier(i)} title="Move earlier">
                      ←
                    </button>
                  )}
                </div>
              ))}
              <label className="ad-tile ad-tile-add">
                <span>+</span>Add photos
                <input type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles('photo', e.target.files), (e.target.value = ''))} />
              </label>
              <label className="ad-tile ad-tile-add">
                <span>+</span>Add video
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  hidden
                  onChange={(e) => (addFiles('video', e.target.files), (e.target.value = ''))}
                />
              </label>
            </div>
            {uploads > 0 && <span className="ad-hint">Uploading {uploads}…</span>}
          </div>

          <label className="ad-field">
            <span className="ad-label">Product name</span>
            <input className="ad-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ribbed Glass Tumbler Set" />
          </label>

          <div className="ad-two">
            <label className="ad-field">
              <span className="ad-label">Category</span>
              <select className="ad-input" value={draft.categoryId} onChange={(e) => set({ categoryId: Number(e.target.value) })}>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ad-field">
              <span className="ad-label">
                Price <em>(optional)</em>
              </span>
              <input className="ad-input" value={draft.price} onChange={(e) => set({ price: e.target.value })} placeholder="RM 24.90" />
            </label>
          </div>

          <label className="ad-field">
            <span className="ad-label">
              My honest review <em>{draft.review.length} characters</em>
            </span>
            <textarea
              className="ad-input"
              rows={5}
              value={draft.review}
              onChange={(e) => set({ review: e.target.value })}
              placeholder="What you love, what to watch out for, any tips…"
            />
          </label>

          <div className="ad-field">
            <span className="ad-label">
              Where to buy <em>Leave blank to hide a button</em>
            </span>
            {PLATFORMS.map((k) => (
              <div className="ad-link-row" key={k}>
                <span className={`chip chip-${k} ad-link-chip`}>{PLATFORM_LABEL[k].chip}</span>
                <input
                  className="ad-input"
                  value={draft[URL_FIELD[k]]}
                  onChange={(e) => set({ [URL_FIELD[k]]: e.target.value })}
                  placeholder={PLACEHOLDER[k]}
                  inputMode="url"
                />
                {k === 'whatsapp' && (
                  <button type="button" className="btn btn-light" onClick={useMyNumber}>
                    Use my number
                  </button>
                )}
              </div>
            ))}
          </div>

          <button type="button" className="switch-button" onClick={() => set({ hidden: !draft.hidden })}>
            <span className={draft.hidden ? 'switch' : 'switch switch-on'} />
            Show on my page
          </button>

          {error && <div className="error-box">{error}</div>}
        </div>
        <div className="ad-drawer-foot">
          {product && (
            <button type="button" className={confirmDelete ? 'btn btn-danger btn-danger-on' : 'btn btn-danger'} onClick={remove}>
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </button>
          )}
          <span className="ad-grow" />
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
