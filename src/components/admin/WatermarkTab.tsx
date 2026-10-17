import { type CSSProperties, useState } from 'react'
import type { WatermarkSettings } from '../../server/validate'
import { JobQueue } from './Library'
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

export function WatermarkTab({ data, act, flash, uploads }: TabProps & { uploads: Uploads }) {
  const [settings, setSettings] = useState(data.watermark)
  const [uploadFolder, setUploadFolder] = useState<number | null>(null)
  const set = (patch: Partial<WatermarkSettings>) => setSettings((s) => ({ ...s, ...patch }))

  function pick(files: FileList | null) {
    if (!files?.length) return
    if (!settings.text.trim()) return flash('Add the watermark text first')
    void uploads.add(files, settings, uploadFolder, flash)
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>Watermark</h2>
          <div className="adm-sub">Upload photos and videos. The server adds your watermark, and finished files go to Media.</div>
        </div>
      </div>
      <div className="adm-wm-start">
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
        <label className="adm-wm-target">
          <span className="adm-sub">Save to</span>
          <select className="adm-input adm-wm-attach" value={uploadFolder ?? ''} onChange={(e) => setUploadFolder(e.target.value ? Number(e.target.value) : null)}>
            <option value="">No folder</option>
            {data.folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="adm-list adm-form adm-list-wide adm-wm-settings">
        <Preview settings={settings} />
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

      <UploadList uploads={uploads} />

      <JobQueue data={data} act={act} />
    </>
  )
}

export function UploadList({ uploads }: { uploads: Uploads }) {
  if (!uploads.items.length) return null
  return (
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
function Preview({ settings }: { settings: WatermarkSettings }) {
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
      {settings.position === 'move' ? <div className="adm-wm-y">{mark}</div> : <div className={`adm-wm-at adm-wm-${settings.position}`}>{mark}</div>}
    </div>
  )
}
