import { useState } from 'react'
import type { AdminJob } from '../../server/catalog'
import { attachMediaFn, deleteJobFn, downloadUrlFn, moveJobFn, retryJobFn, tagWatermarkFn, watermarkJobFn } from '../../server/fns'
import type { TabProps } from './Shell'
import { Select } from './Select'

type Props = Pick<TabProps, 'data' | 'act' | 'flash'> & { job: AdminJob; onDeleted?: () => void }

// The actions for a finished file, on its library card and in the previewer.
export function JobActions({ job, data, act, flash, onDeleted }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const used = new Set(job.productIds)
  const busy = job.watermarking && job.status !== 'failed'

  async function copy() {
    try {
      await navigator.clipboard.writeText(job.url!)
      flash('Link copied')
    } catch {
      flash('Could not copy. Open the file and hold its link to copy it.', true)
    }
  }

  async function save() {
    try {
      const result = await downloadUrlFn({ data: job.id })
      if (!result.ok) return flash(result.error, true)
      window.location.href = result.value
    } catch {
      flash('Could not save this file. Try again.', true)
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true)
    if (await act(deleteJobFn({ data: job.id }), 'Deleted from the library')) onDeleted?.()
  }

  return (
    <div className="adm-job-actions">
      <Select
        className="adm-wm-attach adm-job-product"
        value=""
        aria-label="Add to product"
        disabled={job.watermarking}
        placeholder={used.size ? 'Add to another product…' : 'Add to product…'}
        onChange={(v) => {
          const product = data.products.find((p) => p.id === Number(v))
          if (product) act(attachMediaFn({ data: { productId: product.id, jobId: job.id } }), `Added to ${product.name}`)
        }}
        options={data.products.map((p) => ({ value: String(p.id), label: used.has(p.id) ? `✓ ${p.name}` : p.name, disabled: used.has(p.id) }))}
      />
      <Select
        className="adm-wm-attach"
        value={String(job.folderId ?? '')}
        aria-label="Folder"
        onChange={(v) => {
          const folderId = v ? Number(v) : null
          const name = data.folders.find((f) => f.id === folderId)?.name ?? 'No folder'
          act(moveJobFn({ data: { id: job.id, folderId } }), `Moved to ${name}`)
        }}
        options={[{ value: '', label: 'No folder' }, ...data.folders.map((f) => ({ value: String(f.id), label: f.name }))]}
      />
      {job.watermark !== 'app' && (
        <button
          type="button"
          className="switch-button adm-tag"
          role="switch"
          aria-checked={job.watermark === 'manual'}
          disabled={job.watermarking}
          title="Mark a file that already had a watermark before upload. Nothing changes in the file."
          onClick={() =>
            act(tagWatermarkFn({ data: { id: job.id, tagged: job.watermark === null } }), job.watermark === null ? 'Marked as already watermarked' : 'Mark removed')
          }
        >
          <span className={job.watermark === 'manual' ? 'switch switch-on' : 'switch'} />
          Already has a watermark
        </button>
      )}
      {busy && (
        <button type="button" className="btn btn-dark adm-wm-run" disabled aria-live="polite">
          <span className="adm-spin" aria-hidden="true" />
          {job.status === 'queued' ? 'Waiting…' : `Watermarking ${job.progress}%`}
        </button>
      )}
      {job.watermarking && job.status === 'failed' && (
        <button type="button" className="btn btn-danger btn-danger-on adm-wm-run" title={job.error} onClick={() => act(retryJobFn({ data: job.id }), 'Trying again')}>
          Failed. Try again
        </button>
      )}
      {job.watermark === null && !job.watermarking && (
        <button
          type="button"
          className="btn btn-dark adm-wm-run"
          title="The server draws your watermark on this file and replaces it."
          onClick={() => act(watermarkJobFn({ data: job.id }), 'Watermarking in the background')}
        >
          Add my watermark
        </button>
      )}
      <button type="button" className="btn-icon" onClick={save} title={`Save ${job.type}`} aria-label={`Save ${job.type}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" />
        </svg>
      </button>
      <button type="button" className="btn-icon" onClick={copy} title="Copy link" aria-label="Copy link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
      </button>
      <button type="button" className={confirmDelete ? 'btn btn-delete btn-delete-on' : 'btn btn-delete'} onClick={remove} disabled={busy}>
        {confirmDelete ? 'Tap again' : 'Delete'}
      </button>
    </div>
  )
}
