import { useCallback, useEffect, useRef, useState } from 'react'
import { resizeImage, uploadFile } from '../../lib/upload'
import { compressVideoFn, saveProductFn, takeJobFn } from '../../server/fns'
import { type MediaInput, type ProductInput } from '../../server/validate'

export type ProductMediaItem = MediaInput & { file?: File }
export type ProductUploadRequest = { productId: number; name: string; input: ProductInput; media: ProductMediaItem[] }
type Task = ProductUploadRequest & {
  id: string
  status: 'queued' | 'running' | 'failed'
  stage: string
  progress: number | null
  error: string
}

export function useProductUploads(refresh: () => void) {
  const [tasks, setTasks] = useState<Task[]>([])
  const busy = useRef(false)
  const patch = useCallback((id: string, change: Partial<Task>) => {
    setTasks((list) => list.map((task) => task.id === id ? { ...task, ...change } : task))
  }, [])
  const enqueue = useCallback((request: ProductUploadRequest) => {
    setTasks((list) => [...list, { ...request, id: crypto.randomUUID(), status: 'queued', stage: 'Waiting to upload', progress: null, error: '' }])
  }, [])
  const retry = useCallback((id: string) => patch(id, { status: 'queued', stage: 'Waiting to upload', progress: null, error: '' }), [patch])
  const discard = useCallback((id: string) => setTasks((list) => list.filter((task) => task.id !== id || task.status !== 'failed')), [])

  useEffect(() => {
    const next = tasks.find((task) => task.status === 'queued')
    if (busy.current || !next) return
    busy.current = true
    patch(next.id, { status: 'running' })
    void process(next).then(() => {
      setTasks((list) => list.filter((task) => task.id !== next.id))
      refresh()
    }).catch((error) => {
      patch(next.id, { status: 'failed', stage: 'Failed', progress: null, error: error instanceof Error ? error.message : 'Upload failed. Try again.' })
      refresh()
    }).finally(() => {
      busy.current = false
      setTasks((list) => [...list])
    })

    async function process(task: Task) {
      const media = [...task.media]
      const total = media.filter((item) => item.file).length
      let current = 0
      for (let index = 0; index < media.length; index++) {
        const item = media[index]
        if (!item.file) continue
        current++
        const count = total > 1 ? ` ${current}/${total}` : ''
        const file = item.file
        const startedAt = performance.now()
        patch(task.id, { stage: `Uploading${count}`, progress: 0 })
        const blob = item.type === 'photo' ? await resizeImage(file, 1000) : file
        const compress = item.type === 'video' && file.type === 'video/quicktime'
        const uploaded = await uploadFile(compress ? 'raw' : item.type, blob, (progress) => patch(task.id, { progress }))
        if (!uploaded.ok) throw new Error(`${file.name}: ${uploaded.error}`)
        const uploadMs = Math.round(performance.now() - startedAt)
        let key = uploaded.value.key
        if (compress) {
          const started = await compressVideoFn({ data: { type: 'video', key, name: file.name } })
          if (!started.ok) throw new Error(`${file.name}: ${started.error}`)
          patch(task.id, { stage: `Preparing${count}`, progress: null })
          for (;;) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            const result = await takeJobFn({ data: started.value })
            if (!result.ok) throw new Error(`${file.name}: ${result.error}`)
            const job = result.value
            if (job.status === 'failed') throw new Error(`${file.name}: ${job.error}`)
            if (job.status === 'done' && 'key' in job) {
              key = job.key!
              break
            }
            patch(task.id, {
              stage: job.status === 'queued'
                ? `Waiting${count}`
                : job.progress > 0 ? `Compressing${count}` : `Preparing${count}`,
              progress: job.progress > 0 ? job.progress / 100 : null,
            })
          }
        }
        console.info('Product media timing', { productId: task.productId, type: item.type, bytes: file.size, uploadMs, queueAndProcessMs: Math.round(performance.now() - startedAt - uploadMs) })
        media[index] = { type: item.type, key }
        patch(task.id, { media: [...media], progress: null })
      }
      patch(task.id, { stage: 'Saving media', progress: null })
      const saved = await saveProductFn({ data: { ...task.input, media: media.map(({ type, key }) => ({ type, key })) } })
      if (!saved.ok) throw new Error(saved.error)
    }
  }, [tasks, patch, refresh])

  const active = tasks.some((task) => task.status === 'queued' || task.status === 'running')
  const unfinished = tasks.length > 0
  useEffect(() => {
    if (!unfinished) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    let lock: WakeLockSentinel | undefined
    const awake = () => {
      if (document.visibilityState === 'visible') navigator.wakeLock?.request('screen').then((value) => (lock = value), () => {})
    }
    if (active) awake()
    window.addEventListener('beforeunload', warn)
    if (active) document.addEventListener('visibilitychange', awake)
    return () => {
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('visibilitychange', awake)
      lock?.release()
    }
  }, [active, unfinished])

  return { tasks, enqueue, retry, discard, active }
}

export type ProductUploads = ReturnType<typeof useProductUploads>
