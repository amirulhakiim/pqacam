import { useEffect, useRef, useState } from 'react'
import { wrap } from '../../lib/filter'
import type { AdminJob } from '../../server/catalog'
import { attachMediaFn, deleteJobFn, moveJobFn } from '../../server/fns'
import type { TabProps } from './Shell'

type Props = TabProps & { jobs: AdminJob[]; id: number; onId: (id: number) => void; onClose: () => void }

export function MediaViewer({ jobs, id, onId, onClose, data, act, flash }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const swipeStart = useRef<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const index = jobs.findIndex((j) => j.id === id)
  const job = jobs[index]

  useEffect(() => ref.current?.showModal(), [])
  // The file left this list: deleted, or moved out of the open folder.
  useEffect(() => {
    if (!job) ref.current?.close()
  }, [job])
  useEffect(() => setConfirmDelete(false), [id])

  if (!job) return null
  const go = (step: number) => jobs.length > 1 && onId(jobs[wrap(index + step, jobs.length)].id)
  const folderName = data.folders.find((f) => f.id === job.folderId)?.name ?? 'Unfiled'

  async function copy() {
    try {
      await navigator.clipboard.writeText(job.url!)
      flash('Link copied')
    } catch {
      flash('Could not copy. Hold the link to copy it.')
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true)
    const next = jobs.length > 1 ? jobs[wrap(index + 1, jobs.length)].id : null
    if (await act(deleteJobFn({ data: job.id }), 'Deleted from the library')) {
      if (next === null) ref.current?.close()
      else onId(next)
    }
  }

  return (
    <dialog
      ref={ref}
      className="adm-viewer"
      aria-label={job.name}
      onClose={onClose}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
      onClick={(e) => e.target === ref.current && ref.current.close()}
    >
      <div
        className="adm-viewer-stage"
        onPointerDown={(e) => {
          swipeStart.current = e.clientX
        }}
        onPointerUp={(e) => {
          const dx = e.clientX - (swipeStart.current ?? e.clientX)
          swipeStart.current = null
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        }}
      >
        {job.type === 'photo' ? (
          <img src={job.url!} alt={job.name} draggable={false} />
        ) : (
          <video key={job.id} src={job.url!} controls autoPlay muted playsInline />
        )}
        <button type="button" className="pp-round adm-viewer-close" onClick={() => ref.current?.close()} aria-label="Close">
          ✕
        </button>
        {jobs.length > 1 && (
          <>
            <div className="pp-counter">
              {index + 1} / {jobs.length}
            </div>
            <button type="button" className="pp-round pp-prev" onClick={() => go(-1)} aria-label="Previous">
              ‹
            </button>
            <button type="button" className="pp-round pp-next" onClick={() => go(1)} aria-label="Next">
              ›
            </button>
          </>
        )}
      </div>
      <div className="adm-viewer-info">
        <div>
          <div className="adm-row-name">{job.name}</div>
          <div className="adm-row-meta">
            <span>{job.type === 'photo' ? 'Photo' : 'Video'}</span>
            <span>·</span>
            <span>{folderName}</span>
          </div>
        </div>
        <div className="adm-viewer-actions">
          <select
            className="adm-input adm-wm-attach"
            value=""
            aria-label="Add to product"
            onChange={(e) => {
              const product = data.products.find((p) => p.id === Number(e.target.value))
              if (product) act(attachMediaFn({ data: { productId: product.id, jobId: job.id } }), `Added to ${product.name}`)
            }}
          >
            <option value="">Add to product…</option>
            {data.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="adm-input adm-wm-attach"
            value={job.folderId ?? ''}
            aria-label="Folder"
            onChange={(e) => {
              const folderId = e.target.value ? Number(e.target.value) : null
              const name = data.folders.find((f) => f.id === folderId)?.name ?? 'Unfiled'
              act(moveJobFn({ data: { id: job.id, folderId } }), `Moved to ${name}`)
            }}
          >
            <option value="">Unfiled</option>
            {data.folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-soft" onClick={copy}>
            Copy link
          </button>
          <button type="button" className={confirmDelete ? 'btn btn-danger btn-danger-on' : 'btn btn-danger'} onClick={remove}>
            {confirmDelete ? 'Tap again' : 'Delete'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
