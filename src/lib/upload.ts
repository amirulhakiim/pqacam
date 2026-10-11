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

export async function uploadFile(kind: UploadKind, blob: Blob): Promise<Result<{ key: string; url: string }>> {
  const ticket = await createUploadFn({ data: { kind, contentType: blob.type, size: blob.size } })
  if (!ticket.ok) return ticket
  // The browser sets Content-Length from the blob. It must match the size that the server signed.
  const put = await fetch(ticket.value.uploadUrl, { method: 'PUT', headers: { 'content-type': blob.type }, body: blob })
  if (!put.ok) return { ok: false, error: 'Upload failed. Try again.' }
  return { ok: true, value: { key: ticket.value.key, url: ticket.value.publicUrl } }
}
