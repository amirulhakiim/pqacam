import { useState } from 'react'
import { flushSync } from 'react-dom'
import { withTransition } from '../../lib/transition'
import type { AdminJob } from '../../server/catalog'
import { addFolderFn, deleteFolderFn, deleteJobFn, deleteUnusedJobsFn, renameFolderFn, retryJobFn } from '../../server/fns'
import { VideoThumb } from '../VideoThumb'
import { JobActions } from './JobActions'
import { MediaViewer } from './MediaViewer'
import type { TabProps } from './Shell'
import type { Uploads } from './useUploads'
import { Select } from './Select'
import { UploadList } from './WatermarkTab'

export type FolderFilter = 'all' | 'none' | number
export const inFolder = (j: AdminJob, filter: FolderFilter) =>
  filter === 'all' || (filter === 'none' ? j.folderId === null : j.folderId === filter)

type Show = 'all' | 'unused' | 'watermarked' | 'plain' | 'watermarking'
const SHOW: [Show, string, (j: AdminJob) => boolean][] = [
  ['all', 'All', () => true],
  ['unused', 'Unused', (j) => j.productIds.length === 0],
  ['watermarked', 'Watermarked', (j) => j.watermark !== null],
  ['plain', 'No watermark', (j) => j.watermark === null],
  ['watermarking', 'Watermarking', (j) => j.watermarking],
]

const STATUS: Record<AdminJob['status'], string> = { queued: 'Waiting', processing: 'Watermarking', done: 'Ready', failed: 'Failed' }

type Props = TabProps & { filter: FolderFilter; onFilter: (filter: FolderFilter) => void }

// Files still waiting, processing, or failed. They live in the Watermark section until they are done.
export function JobQueue({ data, act }: Pick<TabProps, 'data' | 'act'>) {
  const [confirm, setConfirm] = useState<number | null>(null)
  const active = data.jobs.filter((j) => j.status !== 'done')
  if (!active.length) return null
  return (
    <div className="adm-list adm-list-wide">
      <h3 className="adm-card-title">In progress</h3>
      {active.map((j) => (
        <div className="adm-row adm-row-slim adm-wm-row" key={j.id}>
          <span className="adm-wm-name">{j.name}</span>
          <span className={j.status === 'failed' ? 'chip chip-warn' : 'chip chip-tiktok'}>
            {j.compressOnly && j.status === 'processing' ? 'Compressing' : STATUS[j.status]}
            {j.status === 'processing' && j.type === 'video' ? ` ${j.progress}%` : ''}
          </span>
          {j.error && <span className="adm-sub">{j.error}</span>}
          {j.status !== 'processing' && (
            <div className="adm-row-actions">
              {j.status === 'failed' && (
                <button type="button" className="btn btn-soft" onClick={() => act(retryJobFn({ data: j.id }))}>
                  Try again
                </button>
              )}
              <button
                type="button"
                className={confirm === j.id ? 'btn btn-danger btn-danger-on' : 'btn btn-danger'}
                onClick={() => (confirm === j.id ? act(deleteJobFn({ data: j.id }), 'Deleted') : setConfirm(j.id))}
              >
                {confirm === j.id ? 'Tap again' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function MediaTab({ uploads, ...props }: TabProps & { uploads: Uploads }) {
  const [filter, setFilter] = useState<FolderFilter>('all')
  return (
    <>
      <div className="adm-head">
        <div>
          <h2>Media</h2>
          <div className="adm-sub">Every photo and video, from products and from Watermark. Deleting a product keeps its files here.</div>
        </div>
        <label className="btn btn-dark btn-round">
          + Add photos &amp; videos
          <input
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void uploads.add(e.target.files, null, typeof filter === 'number' ? filter : null, props.flash)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <UploadList uploads={uploads} />
      <Library {...props} filter={filter} onFilter={setFilter} />
    </>
  )
}

export function Library({ data, act, flash, filter, onFilter }: Props) {
  const [viewing, setViewing] = useState<number | null>(null)
  const [naming, setNaming] = useState<'new' | number | null>(null)
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const done = data.jobs.filter((j) => j.url)
  const [show, setShow] = useState<Show>('all')
  const inShow = SHOW.find(([key]) => key === show)![2]
  const folderFiles = done.filter((j) => inFolder(j, filter))
  const ready = done.filter((j) => j.id === viewing || (inFolder(j, filter) && inShow(j)))
  const current = data.folders.find((f) => f.id === filter)
  const unfiled = done.filter((j) => j.folderId === null).length
  const unusedCount = done.filter((j) => j.status === 'done' && j.productIds.length === 0).length
  const productName = new Map(data.products.map((p) => [p.id, p.name]))

  // Two taps for anything that deletes. The key says which button is armed.
  const armed = (key: string) => {
    if (confirm === key) {
      setConfirm(null)
      return true
    }
    setConfirm(key)
    return false
  }

  function startNaming(target: 'new' | number) {
    setNaming(target)
    setName(target === 'new' ? '' : (current?.name ?? ''))
  }

  async function saveName() {
    if (naming === 'new') {
      const result = await addFolderFn({ data: name })
      if (await act(Promise.resolve(result), 'Folder added')) {
        if (result.ok) onFilter(result.value)
        setNaming(null)
      }
    } else if (naming !== null && (await act(renameFolderFn({ data: { id: naming, name } }), 'Folder renamed'))) {
      setNaming(null)
    }
  }

  async function removeFolder(id: number) {
    if (!armed(`folder-${id}`)) return
    if (await act(deleteFolderFn({ data: id }), 'Folder deleted. Its files are in No folder')) onFilter('all')
  }

  return (
    <div className="adm-list adm-list-wide">
      <div className="adm-wm-filters">
        <label className="adm-wm-filter">
          <span className="adm-filter-label">Folder</span>
          <Select
            className="adm-wm-attach"
            value={String(filter)}
            onChange={(v) => onFilter(v === 'all' || v === 'none' ? v : Number(v))}
            options={[
              { value: 'all', label: `All (${done.length})` },
              { value: 'none', label: `No folder (${unfiled})` },
              ...data.folders.map((f) => ({ value: String(f.id), label: `${f.name} (${done.filter((j) => j.folderId === f.id).length})` })),
            ]}
          />
        </label>
        <label className="adm-wm-filter">
          <span className="adm-filter-label">Show</span>
          <Select
            className="adm-wm-attach"
            value={show}
            onChange={(v) => setShow(v as Show)}
            options={SHOW.filter(([key, , match]) => key !== 'watermarking' || show === key || folderFiles.some(match)).map(([key, label, match]) => ({
              value: key,
              label: `${label} (${folderFiles.filter(match).length})`,
            }))}
          />
        </label>
        <button type="button" className="pill adm-wm-new" onClick={() => startNaming('new')}>
          + New folder
        </button>
      </div>

      {naming !== null && (
        <form
          className="adm-add"
          onSubmit={(e) => {
            e.preventDefault()
            saveName()
          }}
        >
          <input
            className="adm-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name, e.g. Kitchen restock"
            maxLength={60}
            autoFocus
          />
          <button type="submit" className="btn btn-dark">
            {naming === 'new' ? 'Add' : 'Save'}
          </button>
          <button type="button" className="btn btn-light" onClick={() => setNaming(null)}>
            Cancel
          </button>
        </form>
      )}

      {current && naming === null && (
        <div className="adm-wm-folder-head">
          <strong>{current.name}</strong>
          <span className="adm-grow" />
          <button type="button" className="btn btn-soft" onClick={() => startNaming(current.id)}>
            Rename
          </button>
          <button
            type="button"
            className={confirm === `folder-${current.id}` ? 'btn btn-danger btn-danger-on' : 'btn btn-danger'}
            onClick={() => removeFolder(current.id)}
          >
            {confirm === `folder-${current.id}` ? 'Tap again' : 'Delete folder'}
          </button>
        </div>
      )}

      {show === 'unused' && unusedCount > 0 && naming === null && (
        <div className="adm-wm-folder-head">
          <span className="adm-sub">Not on any product. Delete them to free space in the bucket.</span>
          <span className="adm-grow" />
          <button
            type="button"
            className={confirm === 'unused' ? 'btn btn-danger btn-danger-on' : 'btn btn-danger'}
            onClick={() => armed('unused') && act(deleteUnusedJobsFn(), 'Unused files deleted')}
          >
            {confirm === 'unused' ? 'Tap again' : `Delete all ${unusedCount}`}
          </button>
        </div>
      )}

      {ready.map((j) => (
        <div className="adm-row adm-wm-card" key={j.id} style={{ viewTransitionName: `job-${j.id}` }}>
          <button type="button" className="adm-thumb" onClick={() => setViewing(j.id)} aria-label={`Open ${j.name}`}>
            {j.type === 'photo' ? <img src={j.url!} alt="" /> : <VideoThumb url={j.url!} />}
          </button>
          <button type="button" className="adm-row-text" onClick={() => setViewing(j.id)}>
            <span className="adm-row-name">{j.name}</span>
            <span className="adm-row-meta">
              <span>{j.type === 'photo' ? 'Photo' : 'Video'}</span>
              <span className="chip chip-tiktok">{j.watermark ? 'Watermarked' : 'No watermark'}</span>
              {j.productIds.length > 0 ? (
                j.productIds.map((id) => (
                  <span className="chip chip-whatsapp" key={id}>
                    On {productName.get(id)}
                  </span>
                ))
              ) : (
                <span>Not on a product yet</span>
              )}
            </span>
          </button>
          <JobActions job={j} data={data} act={act} flash={flash} />
        </div>
      ))}
      {ready.length === 0 && (
        <div className="adm-none">{done.length ? (show === 'all' ? 'No files in this folder.' : 'No files match this filter.') : 'No media yet. Add photos and videos above, or upload from a product or the Watermark tab.'}</div>
      )}

      {viewing !== null && (
        <MediaViewer jobs={ready} id={viewing} onId={setViewing} onClose={() => void withTransition(() => flushSync(() => setViewing(null)))} data={data} act={act} flash={flash} />
      )}
    </div>
  )
}
