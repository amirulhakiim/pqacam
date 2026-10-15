import { useEffect, useRef, useState } from 'react'
import type { AdminData, AdminJob } from '../../server/catalog'
import { VideoThumb } from '../VideoThumb'
import { type FolderFilter, inFolder } from './Library'

type Props = { jobs: AdminJob[]; folders: AdminData['folders']; taken: string[]; onPick: (job: AdminJob) => void; onClose: () => void }

// A native dialog: it traps focus and closes on Escape.
export function LibraryPicker({ jobs, folders, taken, onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [filter, setFilter] = useState<FolderFilter>('all')
  useEffect(() => ref.current?.showModal(), [])
  const ready = jobs.filter((j) => j.status === 'done' && j.url && inFolder(j, filter))

  return (
    <dialog
      ref={ref}
      className="adm-pick"
      onClose={onClose}
      // Escape closes this dialog only, not the product drawer under it.
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.target === ref.current && ref.current.close()}
    >
      <div className="adm-pick-head">
        <h3>Media</h3>
        <span className="adm-grow" />
        {folders.length > 0 && (
          <select
            className="adm-input adm-wm-attach"
            value={String(filter)}
            aria-label="Folder"
            onChange={(e) => setFilter(e.target.value === 'all' || e.target.value === 'none' ? e.target.value : Number(e.target.value))}
          >
            <option value="all">All folders</option>
            <option value="none">Unfiled</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="adm-x" onClick={() => ref.current?.close()} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="adm-media">
        {ready.map((j) => (
          <button
            type="button"
            key={j.id}
            className="adm-tile adm-tile-pick"
            disabled={taken.includes(j.key)}
            onClick={() => {
              onPick(j)
              ref.current?.close()
            }}
            title={j.name}
          >
            {j.type === 'photo' ? <img src={j.url!} alt="" /> : <VideoThumb url={j.url!} />}
            {j.type === 'video' && <span className="adm-tile-tag">▶ Video</span>}
          </button>
        ))}
      </div>
      {ready.length === 0 && (
        <div className="adm-none">{filter === 'all' ? 'No media yet. Upload from a product or the Watermark tab.' : 'No files in this folder.'}</div>
      )}
    </dialog>
  )
}
