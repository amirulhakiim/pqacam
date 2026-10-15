import { expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_WATERMARK, type WatermarkSettings } from '../src/server/validate'
import { outputSize, parseProbe, photoArgs, probe, videoArgs, watermarkFile } from '../src/server/watermark'

const s: WatermarkSettings = { ...DEFAULT_WATERMARK, text: "@me: it's 100%" }
const vf = (args: string[]) => args[args.indexOf('-vf') + 1]

test('a portrait phone clip is turned and capped at 1920 on the long edge', () => {
  const p = parseProbe(
    JSON.stringify({
      streams: [{ codec_type: 'video', width: 3840, height: 2160, color_transfer: 'arib-std-b67', side_data_list: [{ rotation: -90 }] }],
      format: { duration: '12.5' },
    }),
  )
  expect(p).toEqual({ width: 2160, height: 3840, hdr: true, duration: 12.5 })
  expect(outputSize(p)).toEqual({ width: 1080, height: 1920 })
})

test('video filter: tone map for HDR only, then scale, then the bounce', () => {
  const sdr = vf(videoArgs('in', 'out', 't.txt', s, { width: 1280, height: 720, hdr: false, duration: 1 }))
  expect(sdr).toStartWith('scale=1280:720,drawtext=')
  expect(sdr).toContain("x='abs(mod(t*120\\,2*(w-tw))-(w-tw))'")
  expect(sdr).toContain("y='abs(mod(t*90\\,2*(h-th))-(h-th))'")
  expect(sdr).toContain('fontsize=77:')
  const hdr = vf(videoArgs('in', 'out', 't.txt', s, { width: 1280, height: 720, hdr: true, duration: 1 }))
  expect(hdr).toStartWith('zscale=')
})

test('the watermark text never appears in the arguments', () => {
  const args = videoArgs('in', 'out', 't.txt', s, { width: 1280, height: 720, hdr: false, duration: 1 })
  expect(args.join(' ')).not.toContain('@me')
  expect(args).toContain('-map_metadata')
})

test('a photo with the moving position gets the bottom-right corner', () => {
  const f = vf(photoArgs('in', 'out', 't.txt', s, { width: 1000, height: 800, hdr: false, duration: 0 }))
  expect(f).toContain("x='w-tw-20':y='h-th-20'")
})

const hasFfmpeg = Bun.which('ffmpeg') && Bun.which('ffprobe')

test.skipIf(!hasFfmpeg)('ffmpeg watermarks a real video and a real photo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wm-'))
  const video = join(dir, 'in.mp4')
  const photo = join(dir, 'in.jpg')
  await Bun.spawn(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=2560x1440:rate=30:duration=2',
    '-f', 'lavfi', '-i', 'sine=duration=2', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', video]).exited
  await Bun.spawn(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1000x800', '-frames:v', '1', photo]).exited
  const seen: number[] = []
  await watermarkFile('video', video, join(dir, 'out.mp4'), join(dir, 't.txt'), s, (n) => seen.push(n))
  await watermarkFile('photo', photo, join(dir, 'out.jpg'), join(dir, 't.txt'), s, () => {})
  expect(await probe(join(dir, 'out.mp4'))).toMatchObject({ width: 1920, height: 1080 })
  const streams = await new Response(
    Bun.spawn(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', join(dir, 'out.mp4')]).stdout,
  ).text()
  expect(streams.split('\n').filter(Boolean).sort()).toEqual(['aac', 'h264'])
  expect(seen.length).toBeGreaterThan(0)
  expect((await probe(join(dir, 'out.jpg'))).width).toBe(1000)
}, 60_000)

test.skipIf(!hasFfmpeg)('the text, with a % in it, is drawn on the photo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wm-'))
  const black = join(dir, 'black.jpg')
  await Bun.spawn(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=black:size=400x300', '-frames:v', '1', black]).exited
  await watermarkFile('photo', black, join(dir, 'out.jpg'), join(dir, 't.txt'), { ...s, opacity: 100, position: 'c' }, () => {})
  const gray = await new Response(
    Bun.spawn(['ffmpeg', '-v', 'error', '-i', join(dir, 'out.jpg'), '-f', 'rawvideo', '-pix_fmt', 'gray', '-']).stdout,
  ).bytes()
  expect(gray.filter((v) => v > 200).length).toBeGreaterThan(200)
})
