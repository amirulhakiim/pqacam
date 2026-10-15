import { expect, test } from 'bun:test'
import { validateEmail, validateJobs, validateProduct, validateUpload, validateWatermark } from '../src/server/validate'

const KEY = 'photo/0b9f6c1e-1c2d-4e3f-8a4b-5c6d7e8f9a0b.jpg'
const good = {
  name: ' Tumbler ',
  categoryId: 1,
  price: 'RM 24.90',
  review: 'Nice',
  links: [{ platform: 'shopee', label: '', url: 'https://shopee.com.my/x' }],
  hidden: false,
  media: [{ type: 'photo', key: KEY }],
}
const error = (raw: unknown) => {
  const r = validateProduct(raw)
  return r.ok ? null : r.error
}

test('a valid product passes and the name is trimmed', () => {
  const r = validateProduct(good)
  expect(r.ok && r.value.name).toBe('Tumbler')
})

test('a product needs a name', () => {
  expect(error({ ...good, name: '   ' })).toBe('Give your product a name.')
})

test('a product needs one buy link', () => {
  expect(error({ ...good, links: [] })).toBe('Add at least one Shopee, TikTok or WhatsApp link.')
  expect(error({ ...good, links: [{ platform: 'shopee', label: 'x', url: ' ' }] })).toBe('Add at least one Shopee, TikTok or WhatsApp link.')
  expect(error({ ...good, links: [{ platform: 'lazada', label: '', url: 'https://a.com' }] })).toBe('Add at least one Shopee, TikTok or WhatsApp link.')
})

test.each(['http://shopee.com.my/x', 'javascript:alert(1)', 'shopee.com.my/x', 'https://'])(
  'link %s is refused',
  (url) => {
    expect(error({ ...good, links: [{ platform: 'shopee', label: '', url }] })).toBe('Links must start with https://')
  },
)

test('a media key that the server did not make is refused', () => {
  expect(error({ ...good, media: [{ type: 'photo', key: '../secret' }] })).toBe('Upload the file again.')
})

test('input that is not an object is refused', () => {
  expect(validateProduct(null).ok).toBe(false)
  expect(validateProduct('x').ok).toBe(false)
})

test('an email is lower-cased and checked', () => {
  expect(validateEmail(' Name@Gmail.com ')).toEqual({ ok: true, value: 'name@gmail.com' })
  expect(validateEmail('nope').ok).toBe(false)
})

test('upload rules', () => {
  expect(validateUpload({ kind: 'photo', contentType: 'image/jpeg', size: 300_000 })).toMatchObject({
    ok: true,
    value: { ext: 'jpg' },
  })
  expect(validateUpload({ kind: 'video', contentType: 'video/quicktime', size: 1 })).toMatchObject({
    ok: true,
    value: { ext: 'mov' },
  })
  expect(validateUpload({ kind: 'photo', contentType: 'image/png', size: 1 }).ok).toBe(false)
  expect(validateUpload({ kind: 'video', contentType: 'video/mp4', size: 50 * 1024 * 1024 + 1 }).ok).toBe(false)
  expect(validateUpload({ kind: 'photo', contentType: 'image/jpeg', size: 0 }).ok).toBe(false)
  expect(validateUpload({ kind: 'exe', contentType: 'image/jpeg', size: 1 }).ok).toBe(false)
})

test('a link with emoji or a line break is stored in a form that is safe for a Location header', () => {
  const r = validateProduct({ ...good, links: [{ platform: 'whatsapp', label: '', url: 'https://wa.me/601?text=Hi 😊\r\nX: y' }] })
  const url = r.ok ? r.value.links[0].url : ''
  expect(url).toMatch(/^https:\/\/wa\.me\/601\?text=[\x21-\x7e]+$/)
  expect(() => new Headers({ Location: url })).not.toThrow()
})

test('watermark settings are clamped and need text', () => {
  expect(validateWatermark({ text: '  ' }).ok).toBe(false)
  expect(validateWatermark({ text: ' @me\n now ', size: 99, opacity: 1, speed: 'x', font: 'evil', position: 'tl' })).toEqual({
    ok: true,
    value: { text: '@me now', size: 25, opacity: 10, speed: 120, font: 'sans', position: 'tl' },
  })
})

test('a job needs a raw key of the matching type', () => {
  const raw = 'raw/0b9f6c1e-1c2d-4e3f-8a4b-5c6d7e8f9a0b'
  expect(validateJobs([{ type: 'video', key: `${raw}.mov`, name: 'a.mov' }])).toEqual({
    ok: true,
    value: [{ type: 'video', key: `${raw}.mov`, name: 'a.mov' }],
  })
  expect(validateJobs([{ type: 'photo', key: `${raw}.mov`, name: 'a' }]).ok).toBe(false)
  expect(validateJobs([{ type: 'video', key: KEY, name: 'a' }]).ok).toBe(false)
  expect(validateJobs([]).ok).toBe(false)
})

test('a raw upload can be 1 GB', () => {
  expect(validateUpload({ kind: 'raw', contentType: 'video/quicktime', size: 1024 * 1024 * 1024 }).ok).toBe(true)
  expect(validateUpload({ kind: 'raw', contentType: 'video/mp4', size: 1024 * 1024 * 1024 + 1 }).ok).toBe(false)
})
