import { useState } from 'react'
import type { AdminJob } from '../../server/catalog'
import { addFolderFn, deleteFolderFn, deleteJobFn, renameFolderFn, retryJobFn } from '../../server/fns'
import { MediaViewer } from './MediaViewer'
import type { TabProps } from './Shell'

// 'all' shows every file, 'none' the files in no folder, a number one folder.
export type FolderFilter = 'all' | 'none' | number
export const inFolder = (j: AdminJob, filter: FolderFilter) =>
  filter === 'all' || (filter === 'none' ? j.folderId === null : j.folderId === filter)

const STATUS: Record<AdminJob['status'], string> = { queued: 'Waiting', processing: 'Watermarking', done: 'Ready', failed: 'Failed' }

type Props = TabProps & { filter: FolderFilter; onFilter: (filter: FolderFilter) => void; uploading: boolean }

export function Library({ data, act, flash, filter, onFilter, uploading }: Props) {
  const [viewing, setViewing] = useState<number | null>(null)
  const [naming, setNaming] = useState<'new' | number | null>(null)
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const shown = data.jobs.filter((j) => inFolder(j, filter))
  const ready = shown.filter((j) => j.status === 'done' && j.url)
  const current = data.folders.find((f) => f.id === filter)
  const unfiled = data.jobs.filter((j) => j.folderId === null).length

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
    if (await act(deleteFolderFn({ data: id }), 'Folder deleted. Its files are in Unfiled')) onFilter('all')
  }

  const pill = (key: FolderFilter, label: string, count: number) => (
    <button type="button" key={String(key)} className={filter === key ? 'pill pill-on' : 'pill'} onClick={() => onFilter(key)}>
      {label} <span className="adm-wm-count">{count}</span>
    </button>
  )

  return (
    <div className="adm-list adm-list-wide">
      <div className="adm-wm-folders">
        {pill('all', 'All', data.jobs.length)}
        {pill('none', 'Unfiled', unfiled)}
        {data.folders.map((f) => pill(f.id, f.name, f.count))}
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
          <span className="adm-sub">{uploading ? 'Uploads go to' : 'New uploads go to'}</span>
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

      {shown.map((j) => {
        const open = j.status === 'done' && j.url ? () => setViewing(j.id) : undefined
        return (
          <div className="adm-row" key={j.id}>
            <button type="button" className="adm-thumb" onClick={open} disabled={!open} aria-label={`Open ${j.name}`}>
              {j.url && (j.type === 'photo' ? <img src={j.url} alt="" /> : <video src={`${j.url}#t=0.1`} muted preload="metadata" />)}
            </button>
            <button type="button" className="adm-row-text" onClick={open} disabled={!open}>
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
            </button>
            {(j.status === 'queued' || j.status === 'failed') && (
              <div className="adm-row-actions">
                {j.status === 'failed' && (
                  <button type="button" className="btn btn-soft" onClick={() => act(retryJobFn({ data: j.id }))}>
                    Try again
                  </button>
                )}
                <button
                  type="button"
                  className={confirm === `job-${j.id}` ? 'btn btn-danger btn-danger-on' : 'btn btn-danger'}
                  onClick={() => armed(`job-${j.id}`) && act(deleteJobFn({ data: j.id }), 'Deleted from the library')}
                >
                  {confirm === `job-${j.id}` ? 'Tap again' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        )
      })}
      {shown.length === 0 && (
        <div className="adm-none">{data.jobs.length ? 'No files in this folder.' : 'No watermarked files yet. Add photos and videos to start.'}</div>
      )}

      {viewing !== null && (
        <MediaViewer jobs={ready} id={viewing} onId={setViewing} onClose={() => setViewing(null)} data={data} act={act} flash={flash} />
      )}
    </div>
  )
}
