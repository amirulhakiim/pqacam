import { useState } from 'react'
import type { AdminJob } from '../../server/catalog'
import { attachMediaFn, deleteJobFn, moveJobFn } from '../../server/fns'
import type { TabProps } from './Shell'

type Props = Pick<TabProps, 'data' | 'act' | 'flash'> & { job: AdminJob; onDeleted?: () => void }

// The actions for a finished file, on its library card and in the previewer.
export function JobActions({ job, data, act, flash, onDeleted }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const used = new Set(job.productIds)

  async function copy() {
    try {
      await navigator.clipboard.writeText(job.url!)
      flash('Link copied')
    } catch {
      flash('Could not copy. Open the file and hold its link to copy it.', true)
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true)
    if (await act(deleteJobFn({ data: job.id }), 'Deleted from the library')) onDeleted?.()
  }

  return (
    <div className="adm-job-actions">
      <select
        className="adm-input adm-wm-attach"
        value=""
        aria-label="Add to product"
        onChange={(e) => {
          const product = data.products.find((p) => p.id === Number(e.target.value))
          if (product) act(attachMediaFn({ data: { productId: product.id, jobId: job.id } }), `Added to ${product.name}`)
        }}
      >
        <option value="">{used.size ? 'Add to another product…' : 'Add to product…'}</option>
        {data.products.map((p) => (
          // A product that already has the file is ticked and cannot be picked again.
          <option key={p.id} value={p.id} disabled={used.has(p.id)}>
            {used.has(p.id) ? `✓ ${p.name}` : p.name}
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
  )
}
