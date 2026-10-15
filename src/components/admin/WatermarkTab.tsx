import { type CSSProperties, useState } from 'react'
import type { AdminJob } from '../../server/catalog'
import { attachMediaFn, deleteJobFn, retryJobFn } from '../../server/fns'
import type { WatermarkSettings } from '../../server/validate'
import type { TabProps } from './Shell'
import type { Uploads } from './useUploads'

const FONT_LABEL: Record<WatermarkSettings['font'], string> = {
  sans: 'Standard',
  serif: 'Serif',
  mono: 'Typewriter',
  comic: 'Rounded',
  script: 'Script',
  pacifico: 'Pacifico',
}
const POSITION_LABEL: Record<WatermarkSettings['position'], string> = {
  move: 'Moving (bounce)',
  br: 'Bottom right',
  bl: 'Bottom left',
  tr: 'Top right',
  tl: 'Top left',
  c: 'Center',
}
const STATUS: Record<AdminJob['status'], string> = { queued: 'Waiting', processing: 'Watermarking', done: 'Ready', failed: 'Failed' }

export function WatermarkTab({ data, act, flash, uploads }: TabProps & { uploads: Uploads }) {
  const [settings, setSettings] = useState(data.watermark)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const set = (patch: Partial<WatermarkSettings>) => setSettings((s) => ({ ...s, ...patch }))
  const backdrop = data.jobs.find((j) => j.type === 'photo' && j.url)?.url ?? undefined

  function pick(files: FileList | null) {
    if (!files?.length) return
    if (!settings.text.trim()) return flash('Add the watermark text first')
    uploads.add(files, settings)
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      flash('Link copied')
    } catch {
      flash('Could not copy. Hold the link to copy it.')
    }
  }

  function remove(id: number) {
    if (confirmDelete !== id) return setConfirmDelete(id)
    setConfirmDelete(null)
    act(deleteJobFn({ data: id }), 'Deleted from the library')
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>Watermark</h2>
          <div className="adm-sub">Upload photos and videos. The server adds your watermark, and they wait here for you.</div>
        </div>
        <label className="btn btn-dark btn-round adm-wm-add">
          + Add photos &amp; videos
          <input
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm"
            multiple
            hidden
            onChange={(e) => (pick(e.target.files), (e.target.value = ''))}
          />
        </label>
      </div>

      <div className="adm-list adm-form adm-list-wide adm-wm-settings">
        <Preview settings={settings} backdrop={backdrop} />
        <div className="adm-wm-fields">
          <label className="adm-field">
            <span className="adm-label">Watermark text</span>
            <input className="adm-input" value={settings.text} maxLength={100} onChange={(e) => set({ text: e.target.value })} />
          </label>
          <div className="adm-two">
            <label className="adm-field">
              <span className="adm-label">Font</span>
              <select className="adm-input" value={settings.font} onChange={(e) => set({ font: e.target.value as WatermarkSettings['font'] })}>
                {Object.entries(FONT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span className="adm-label">Position</span>
              <select
                className="adm-input"
                value={settings.position}
                onChange={(e) => set({ position: e.target.value as WatermarkSettings['position'] })}
              >
                {Object.entries(POSITION_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="adm-two">
            <Slider label="Size" unit="%" min={2} max={25} value={settings.size} onChange={(size) => set({ size })} />
            <Slider label="Opacity" unit="%" min={10} max={100} value={settings.opacity} onChange={(opacity) => set({ opacity })} />
            {settings.position === 'move' && (
              <Slider label="Speed" unit="" min={40} max={400} value={settings.speed} onChange={(speed) => set({ speed })} />
            )}
          </div>
          <span className="adm-hint">
            {settings.position === 'move' ? 'Photos get the bottom-right corner. ' : ''}Videos are saved at up to 1080p. Each batch uses
            the settings at the time you add it.
          </span>
        </div>
      </div>

      {uploads.items.length > 0 && (
        <div className="adm-list adm-list-wide">
          <div className="adm-wm-note">Uploading. You can use other tabs, but keep this page open until the uploads finish.</div>
          {uploads.items.map((u) => (
            <div className="adm-row adm-row-slim adm-wm-row" key={u.id}>
              <span className="adm-wm-name">{u.file.name}</span>
              {u.error ? (
                <>
                  <span className="chip chip-warn">{u.error}</span>
                  <div className="adm-row-actions">
                    <button type="button" className="btn btn-soft" onClick={() => uploads.retry(u.id)}>
                      Try again
                    </button>
                    <button type="button" className="btn-icon" onClick={() => uploads.remove(u.id)} title="Remove">
                      ✕
                    </button>
                  </div>
                </>
              ) : (
                <span className="adm-bar">
                  <span style={{ width: `${Math.round(u.progress * 100)}%` }} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="adm-list adm-list-wide">
        {data.jobs.map((j) => (
          <div className="adm-row" key={j.id}>
            <div className="adm-thumb adm-wm-thumb">
              {j.url && (j.type === 'photo' ? <img src={j.url} alt="" /> : <video src={`${j.url}#t=0.1`} muted preload="metadata" />)}
            </div>
            <div className="adm-row-text">
              <span className="adm-row-name">{j.name}</span>
              <span className="adm-row-meta">
                <span>{j.type === 'photo' ? 'Photo' : 'Video'}</span>
                <span>·</span>
                <span className={j.status === 'failed' ? 'chip chip-warn' : j.status === 'done' ? 'chip chip-whatsapp' : 'chip chip-tiktok'}>
                  {STATUS[j.status]}
                  {j.status === 'processing' && j.type === 'video' ? ` ${j.progress}%` : ''}
                </span>
                {j.error && <span>{j.error}</span>}
              </span>
            </div>
            <div className="adm-row-actions adm-wm-actions">
              {j.status === 'done' && j.url && (
                <>
                  <select
                    className="adm-input adm-wm-attach"
                    value=""
                    aria-label="Add to product"
                    onChange={(e) => {
                      const product = data.products.find((p) => p.id === Number(e.target.value))
                      if (product) act(attachMediaFn({ data: { productId: product.id, jobId: j.id } }), `Added to ${product.name}`)
                    }}
                  >
                    <option value="">Add to product…</option>
                    {data.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-soft" onClick={() => copy(j.url!)}>
                    Copy link
                  </button>
                </>
              )}
              {j.status === 'failed' && (
                <button type="button" className="btn btn-soft" onClick={() => act(retryJobFn({ data: j.id }))}>
                  Try again
                </button>
              )}
              {j.status !== 'processing' && (
                <button type="button" className={confirmDelete === j.id ? 'btn btn-danger btn-danger-on' : 'btn btn-danger'} onClick={() => remove(j.id)}>
                  {confirmDelete === j.id ? 'Tap again' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        ))}
        {data.jobs.length === 0 && uploads.items.length === 0 && (
          <div className="adm-none">No watermarked files yet. Add photos and videos to start.</div>
        )}
      </div>
    </>
  )
}

function Slider(props: { label: string; unit: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="adm-field">
      <span className="adm-label">
        {props.label}
        <em>
          {props.value}
          {props.unit}
        </em>
      </span>
      <input
        type="range"
        className="adm-range"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  )
}

// An approximation of the server render: the font size follows the frame width, as it does in ffmpeg.
// The bounce takes the time a 1920 px frame would take at this speed.
function Preview({ settings, backdrop }: { settings: WatermarkSettings; backdrop?: string }) {
  const style = {
    '--size': settings.size,
    '--dx': `${1400 / settings.speed}s`,
    '--dy': `${800 / Math.max(1, settings.speed * 0.75)}s`,
    fontFamily: `wm-${settings.font}`,
    color: `rgb(255 255 255 / ${settings.opacity}%)`,
  } as CSSProperties
  const mark = <span className="adm-wm-mark">{settings.text || ' '}</span>
  return (
    <div className="adm-wm-stage" style={style} aria-hidden="true">
      {backdrop && <img src={backdrop} alt="" />}
      {settings.position === 'move' ? <div className="adm-wm-y">{mark}</div> : <div className={`adm-wm-at adm-wm-${settings.position}`}>{mark}</div>}
    </div>
  )
}
