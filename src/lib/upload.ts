import { createUploadFn } from '../server/fns'
import type { Result, UploadKind } from '../server/validate'

export async function resizeImage(file: Blob, max: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))), 'image/jpeg', 0.82),
  )
}

// XMLHttpRequest, not fetch: fetch reports no upload progress, and a large video needs a progress bar.
function put(url: string, blob: Blob, onProgress?: (fraction: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', blob.type)
    if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
    xhr.onerror = () => resolve(false)
    xhr.send(blob)
  })
}

export async function uploadFile(
  kind: UploadKind,
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<Result<{ key: string; url: string }>> {
  const ticket = await createUploadFn({ data: { kind, contentType: blob.type, size: blob.size } })
  if (!ticket.ok) return ticket
  // The browser sets Content-Length from the blob. It must match the size that the server signed.
  if (!(await put(ticket.value.uploadUrl, blob, onProgress))) return { ok: false, error: 'Upload failed. Try again.' }
  return { ok: true, value: { key: ticket.value.key, url: ticket.value.publicUrl } }
}
