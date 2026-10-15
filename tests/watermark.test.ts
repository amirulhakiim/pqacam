import { expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_WATERMARK, type WatermarkSettings } from '../src/server/validate'
import { outputSize, parseProbe, photoArgs, probe, sizeCap, TooLargeError, videoArgs, watermarkFile } from '../src/server/watermark'

const s: WatermarkSettings = { ...DEFAULT_WATERMARK, text: "@me: it's 100%" }
const vf = (args: string[]) => args[args.indexOf('-vf') + 1]

test('a portrait phone clip is turned and capped at 1920 on the long edge', () => {
  const p = parseProbe(
    JSON.stringify({
      streams: [{ codec_type: 'video', width: 3840, height: 2160, color_transfer: 'arib-std-b67', side_data_list: [{ rotation: -90 }] }],
      format: { duration: '12.5' },
    }),
  )
  expect(p).toEqual({ width: 2160, height: 3840, hdr: 'arib-std-b67', duration: 12.5 })
  expect(outputSize(p)).toEqual({ width: 1080, height: 1920 })
})

test('video filter: tone map for HDR only, then scale, then the bounce', () => {
  const sdr = vf(videoArgs('in', 'out', 't.txt', s, { width: 1280, height: 720, hdr: false, duration: 1 }))
  expect(sdr).toStartWith('scale=1280:720,drawtext=')
  expect(sdr).toContain("x='abs(mod(t*120\\,2*(w-tw))-(w-tw))'")
  expect(sdr).toContain("y='abs(mod(t*90\\,2*(h-th))-(h-th))'")
  expect(sdr).toContain('fontsize=77:')
  const hdr = vf(videoArgs('in', 'out', 't.txt', s, { width: 1280, height: 720, hdr: 'smpte2084', duration: 1 }))
  expect(hdr).toStartWith('zscale=tin=smpte2084:')
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

test.skipIf(!hasFfmpeg)('an HLG clip is tone mapped to SDR', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wm-'))
  const hlg = join(dir, 'hlg.mp4')
  await Bun.spawn(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:duration=1',
    '-vf', 'setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc', '-pix_fmt', 'yuv420p10le', '-c:v', 'libx264', hlg]).exited
  expect((await probe(hlg)).hdr).toBe('arib-std-b67')
  const out = join(dir, 'out.mp4')
  await watermarkFile('video', hlg, out, join(dir, 't.txt'), s, () => {})
  expect((await probe(out)).hdr).toBe(false)
}, 60_000)

test('compress only: no drawtext, and the size cap pass is 720p at a fitted bitrate', () => {
  const p = { width: 3840, height: 2160, hdr: false as const, duration: 120 }
  const plain = vf(videoArgs('in', 'out', 't.txt', null, p))
  expect(plain).toBe('scale=1920:1080')
  const cap = sizeCap(120)
  // 50 MB, less 10%, over 120 s, less 96 kb/s for audio.
  expect(cap.videoBitrate).toBe(Math.floor((50 * 1024 * 1024 * 0.9 * 8) / 120) - 96_000)
  const capped = videoArgs('in', 'out', 't.txt', null, p, cap)
  expect(vf(capped)).toBe('scale=1280:720')
  expect(capped).toContain(String(cap.videoBitrate))
  expect(capped).not.toContain('-crf')
})

test.skipIf(!hasFfmpeg)('a video over the limit is compressed again until it fits, keeping its sound', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wm-'))
  const big = join(dir, 'big.mp4')
  // Noise does not compress, so the first pass is far over a 300 KB limit.
  await Bun.spawn(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=4,noise=alls=60:allf=t',
    '-f', 'lavfi', '-i', 'sine=duration=4', '-shortest', '-c:v', 'libx264', '-crf', '18', '-c:a', 'aac', big]).exited
  const out = join(dir, 'out.mp4')
  const seen: number[] = []
  const bytes = await watermarkFile('video', big, out, join(dir, 't.txt'), null, (n) => seen.push(n), 300_000)
  expect(bytes).toBeLessThanOrEqual(300_000)
  expect(bytes).toBe(Bun.file(out).size)
  expect(Math.max(...seen)).toBeGreaterThanOrEqual(50)
  const streams = await new Response(
    Bun.spawn(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,width', '-of', 'csv=p=0', out]).stdout,
  ).text()
  expect(streams).toContain('aac')
  expect(streams).toContain('h264,1280')
  // A limit no video can meet is an error the admin can act on, not a silent oversize file.
  await expect(watermarkFile('video', big, out, join(dir, 't.txt'), null, () => {}, 10_000)).rejects.toBeInstanceOf(TooLargeError)
}, 120_000)
