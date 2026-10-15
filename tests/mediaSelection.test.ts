import { expect, test } from 'bun:test'
import { mediaSizeError } from '../src/lib/mediaSelection'

test('selection limits videos to 50 MB and photos to 100 MB', () => {
  const video = { name: 'clip.mov', size: 50 * 1024 * 1024 } as File
  const photo = { name: 'photo.jpg', size: 100 * 1024 * 1024 } as File
  expect(mediaSizeError(video, 'video')).toBeNull()
  expect(mediaSizeError({ ...video, size: video.size + 1 }, 'video')).toContain('50 MB')
  expect(mediaSizeError(photo, 'photo')).toBeNull()
  expect(mediaSizeError({ ...photo, size: photo.size + 1 }, 'photo')).toContain('100 MB')
})
