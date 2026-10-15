import { useEffect, useRef } from 'react'
import type { AdminJob } from '../../server/catalog'

type Props = { jobs: AdminJob[]; taken: string[]; onPick: (job: AdminJob) => void; onClose: () => void }

// A native dialog: it traps focus and closes on Escape.
export function LibraryPicker({ jobs, taken, onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => ref.current?.showModal(), [])
  const ready = jobs.filter((j) => j.status === 'done' && j.url)

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
        <h3>Watermarked files</h3>
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
            {j.type === 'photo' ? <img src={j.url!} alt="" /> : <video src={`${j.url}#t=0.1`} muted preload="metadata" />}
            {j.type === 'video' && <span className="adm-tile-tag">▶ Video</span>}
          </button>
        ))}
      </div>
      {ready.length === 0 && <div className="adm-none">No watermarked files yet. Add them in the Watermark tab.</div>}
    </dialog>
  )
}
