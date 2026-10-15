import { useCallback, useEffect, useRef, useState } from 'react'
import { resizeImage, uploadFile } from '../../lib/upload'
import { addJobsFn } from '../../server/fns'
import type { WatermarkSettings } from '../../server/validate'

export type Upload = {
  id: string
  file: File
  type: 'photo' | 'video'
  settings: WatermarkSettings
  folderId: number | null
  progress: number
  error: string
}
export type Uploads = ReturnType<typeof useUploads>

// Lives in the admin route, not in a tab, so uploads continue while the admin uses other tabs.
// A browser cannot upload from a closed page, so the page warns before it closes and keeps the screen awake.
export function useUploads(onUploaded: () => void) {
  const [items, setItems] = useState<Upload[]>([])
  const busy = useRef(false)
  const update = (id: string, patch: Partial<Upload>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  const add = useCallback((files: FileList | File[], settings: WatermarkSettings, folderId: number | null) => {
    const picked = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      type: file.type.startsWith('video/') ? ('video' as const) : ('photo' as const),
      settings,
      folderId,
      progress: 0,
      error: '',
    }))
    setItems((list) => [...list, ...picked])
  }, [])

  const retry = (id: string) => update(id, { error: '', progress: 0 })
  const remove = (id: string) => setItems((list) => list.filter((i) => i.id !== id))

  // One file at a time, so the first files reach the server, and start watermarking, as early as possible.
  useEffect(() => {
    const next = items.find((i) => !i.error)
    if (busy.current || !next) return
    busy.current = true
    send(next)
      .then((error) => (error ? update(next.id, { error }) : (remove(next.id), onUploaded())))
      .finally(() => {
        busy.current = false
        setItems((list) => [...list])
      })
  }, [items, onUploaded])

  async function send(item: Upload): Promise<string> {
    try {
      const blob = item.type === 'photo' ? await resizeImage(item.file, 1000) : item.file
      const uploaded = await uploadFile('raw', blob, (progress) => update(item.id, { progress }))
      if (!uploaded.ok) return uploaded.error
      const job = { type: item.type, key: uploaded.value.key, name: item.file.name }
      const added = await addJobsFn({ data: { jobs: [job], settings: item.settings, folderId: item.folderId } })
      return added.ok ? '' : added.error
    } catch {
      return 'Upload failed. Check your connection and try again.'
    }
  }

  const active = items.some((i) => !i.error)
  useEffect(() => {
    if (!active) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    let lock: WakeLockSentinel | undefined
    // The browser drops the lock when the page is hidden, so it is asked for again on return.
    const awake = () => {
      if (document.visibilityState === 'visible') navigator.wakeLock?.request('screen').then((l) => (lock = l), () => {})
    }
    awake()
    window.addEventListener('beforeunload', warn)
    document.addEventListener('visibilitychange', awake)
    return () => {
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('visibilitychange', awake)
      lock?.release()
    }
  }, [active])

  return { items, add, retry, remove, active }
}
