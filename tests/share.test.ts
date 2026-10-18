import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { shareVersion } from '../src/lib/share'
import { drawable, shareArgs, wrapLines } from '../src/server/share'
import { probe } from '../src/server/watermark'

const dir = mkdtempSync(join(tmpdir(), 'share-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

test('a long name wraps by word and ends with an ellipsis past the last line', () => {
  expect(wrapLines('M1 ~ Hooga Car Fragrance & Refill', 17, 3)).toEqual(['M1 ~ Hooga Car', 'Fragrance &', 'Refill'])
  expect(wrapLines('one two three four five six seven eight nine ten', 9, 2)).toEqual(['one two', 'three…'])
  expect(wrapLines('Supercalifragilistic', 8, 3)).toEqual(['Supercal', 'ifragili', 'stic'])
})

test('emoji and hidden characters are dropped before drawing', () => {
  expect(drawable('Hooga 😭￼  Car ✨')).toBe('Hooga Car')
})

test('the share version changes with the cover, name and price', () => {
  const p = { id: 1, name: 'Vase', shortName: '', price: '', media: [{ type: 'photo', url: 'a.jpg' }] }
  const v = shareVersion(p)
  expect(shareVersion({ ...p, price: 'RM 5' })).not.toBe(v)
  expect(shareVersion({ ...p, media: [{ type: 'photo', url: 'b.jpg' }] })).not.toBe(v)
  expect(shareVersion({ ...p })).toBe(v)
})

const hasFfmpeg = Bun.which('ffmpeg') && Bun.which('ffprobe')

test.skipIf(!hasFfmpeg)('ffmpeg draws a 1200 by 630 share image from a portrait photo', async () => {
  const input = join(dir, 'in.jpg')
  await Bun.spawn(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1536x2048', '-frames:v', '1', input]).exited
  const files = { lines: [join(dir, 'n0.txt'), join(dir, 'n1.txt')], price: join(dir, 'p.txt'), site: join(dir, 's.txt') }
  writeFileSync(files.lines[0], "Hooga Car 100%: it's")
  writeFileSync(files.lines[1], 'Fragrance')
  writeFileSync(files.price, 'RM 24.90')
  writeFileSync(files.site, 'pqacam.com')
  const output = join(dir, 'out.jpg')
  expect(await Bun.spawn(['ffmpeg', ...shareArgs(input, output, files)]).exited).toBe(0)
  expect(await probe(output)).toMatchObject({ width: 1200, height: 630 })
})
