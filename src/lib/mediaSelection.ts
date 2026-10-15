import { MEDIA_MAX_MB, VIDEO_MAX_MB } from '../server/validate'

export function mediaSizeError(file: File, type: 'photo' | 'video'): string | null {
  const limit = type === 'video' ? VIDEO_MAX_MB : MEDIA_MAX_MB
  return file.size > limit * 1024 * 1024 ? `${file.name} is over ${limit} MB. Choose a smaller file.` : null
}
