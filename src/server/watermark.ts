import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { VIDEO_MAX_MB, type WatermarkSettings } from './validate'

// Vite serves public/ in development. The Docker image has only the built copy.
const FONT_DIR = resolve(existsSync('public/fonts') ? 'public/fonts' : 'dist/client/fonts')
export const fontFile = (font: WatermarkSettings['font']) => `${FONT_DIR}/${font}.ttf`

// hdr is the transfer of an HDR video, or false for SDR.
export type Probe = { width: number; height: number; hdr: false | 'smpte2084' | 'arib-std-b67'; duration: number; codec?: string; audioCodec?: string | null }
const MAX_EDGE = 1920
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

export function parseProbe(json: string): Probe {
  const data = JSON.parse(json)
  const v = (data.streams ?? []).find((s: { codec_type?: string }) => s.codec_type === 'video')
  if (!v) throw new Error('no video stream')
  const rotation = Number(v.side_data_list?.find((d: { rotation?: number }) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0)
  const turned = Math.abs(rotation) % 180 === 90
  const [rate, divisor] = String(v.avg_frame_rate ?? '').split('/').map(Number)
  const frames = Number(v.nb_frames)
  const duration = [data.format?.duration, v.duration, frames > 0 && rate > 0 && divisor > 0 ? (frames * divisor) / rate : 0]
    .map(Number)
    .find((value) => Number.isFinite(value) && value > 0) ?? 0
  return {
    width: turned ? v.height : v.width,
    height: turned ? v.width : v.height,
    hdr: ['smpte2084', 'arib-std-b67'].includes(v.color_transfer) ? v.color_transfer : false,
    duration,
    codec: v.codec_name,
    audioCodec: (data.streams ?? []).find((s: { codec_type?: string }) => s.codec_type === 'audio')?.codec_name ?? null,
  }
}

// The size the output has after rotation and the 1080p cap, so the font size can follow the real width.
export function outputSize(p: Probe, maxEdge = MAX_EDGE) {
  const k = Math.min(1, maxEdge / Math.max(p.width, p.height))
  return { width: even(p.width * k), height: even(p.height * k) }
}

function drawtext(s: WatermarkSettings, width: number, textFile: string, still: boolean) {
  const px = Math.max(8, Math.round((width * s.size) / 100))
  const pad = Math.max(20, Math.round(px / 3))
  const position = still && s.position === 'move' ? 'br' : s.position
  // The same triangle wave as the watermarker and its watermark.sh, so the bounce path does not change.
  const slow = Math.max(1, Math.round(s.speed * 0.75))
  const [x, y] = {
    move: [`abs(mod(t*${s.speed}\\,2*(w-tw))-(w-tw))`, `abs(mod(t*${slow}\\,2*(h-th))-(h-th))`],
    tl: [`${pad}`, `${pad}`],
    tr: [`w-tw-${pad}`, `${pad}`],
    bl: [`${pad}`, `h-th-${pad}`],
    br: [`w-tw-${pad}`, `h-th-${pad}`],
    c: ['(w-tw)/2', '(h-th)/2'],
  }[position]
  // textfile, not text=: the admin's text never goes through filtergraph escaping. expansion=none keeps a % as a %.
  return `drawtext=fontfile='${fontFile(s.font)}':textfile='${textFile}':expansion=none:fontsize=${px}:fontcolor=white@${s.opacity / 100}:x='${x}':y='${y}'`
}

// The input colorspace is stated, not read from the stream: zscale stops with "no path between colorspaces" when a tag is missing.
const tonemap = (transfer: string) =>
  `zscale=tin=${transfer}:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p`

export const MAX_VIDEO_BYTES = VIDEO_MAX_MB * 1024 * 1024
// A second pass when the first is over the limit: 720p, and a video bitrate that fits the length with 10% to spare.
export type SizeCap = { maxEdge: number; videoBitrate: number }
export const sizeCap = (duration: number, limit = MAX_VIDEO_BYTES): SizeCap => ({
  maxEdge: 1280,
  videoBitrate: Math.max(150_000, Math.floor((limit * 0.9 * 8) / Math.max(1, duration)) - 96_000),
})

// s is null to compress only, with no watermark.
export function videoArgs(input: string, output: string, textFile: string, s: WatermarkSettings | null, p: Probe, cap?: SizeCap): string[] {
  const out = outputSize(p, cap?.maxEdge)
  const filter = [p.hdr && tonemap(p.hdr), `scale=${out.width}:${out.height}`, s && drawtext(s, out.width, textFile, false)].filter(Boolean).join(',')
  const rate = cap ? ['-b:v', String(cap.videoBitrate), '-maxrate', String(Math.round(cap.videoBitrate * 1.2)), '-bufsize', String(cap.videoBitrate * 2)] : ['-crf', '18']
  return [
    ...['-hide_banner', '-nostats', '-y', '-i', input, '-vf', filter, '-map', '0:v:0', '-map', '0:a:0?'],
    // -map_metadata -1 drops the phone's GPS location and other tags.
    ...['-map_metadata', '-1', '-c:v', 'libx264', '-preset', 'veryfast', ...rate, '-pix_fmt', 'yuv420p'],
    ...['-c:a', 'aac', '-b:a', cap ? '96k' : '128k', '-movflags', '+faststart', '-threads', '2', '-progress', 'pipe:1', output],
  ]
}

export function remuxArgs(input: string, output: string, p: Probe): string[] {
  const audio = p.audioCodec === 'aac' ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '192k']
  return ['-hide_banner', '-nostats', '-y', '-i', input, '-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1', '-c:v', 'copy', ...audio, '-movflags', '+faststart', output]
}

export function photoArgs(input: string, output: string, textFile: string, s: WatermarkSettings, p: Probe): string[] {
  return ['-hide_banner', '-nostats', '-y', '-i', input, '-vf', drawtext(s, p.width, textFile, true), '-map_metadata', '-1', '-q:v', '3', '-frames:v', '1', '-update', '1', output]
}

export async function* streamLines(stream: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let pending = ''
  for await (const chunk of stream) {
    pending += decoder.decode(chunk, { stream: true })
    let newline = pending.indexOf('\n')
    while (newline !== -1) {
      yield pending.slice(0, newline)
      pending = pending.slice(newline + 1)
      newline = pending.indexOf('\n')
    }
  }
  pending += decoder.decode()
  if (pending) yield pending
}

export async function run(cmd: string[], onLine?: (line: string) => void): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
  const stderr = new Response(proc.stderr).text()
  let stdout = ''
  let stalled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const resetTimer = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      stalled = true
      proc.kill()
    }, 10 * 60_000)
  }
  resetTimer()
  try {
    for await (const line of streamLines(proc.stdout)) {
      resetTimer()
      if (onLine) onLine(line)
      else stdout += `${line}\n`
    }
    if ((await proc.exited) !== 0) {
      throw new Error(stalled ? `${cmd[0]} stopped responding` : `${cmd[0]} failed: ${(await stderr).trim().split('\n').slice(-3).join(' | ')}`)
    }
  } finally {
    clearTimeout(timer)
  }
  return stdout
}

export const probe = async (path: string) =>
  parseProbe(await run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]))

export class TooLargeError extends Error {}

// Returns the size of the result in bytes. A video always ends under the product video limit, or this throws TooLargeError.
// s is null to compress a video only, with no watermark.
export async function watermarkFile(
  type: 'photo' | 'video',
  input: string,
  output: string,
  textFile: string,
  s: WatermarkSettings | null,
  onProgress: (percent: number) => void,
  limit = MAX_VIDEO_BYTES,
): Promise<number> {
  if (s) await Bun.write(textFile, s.text)
  const p = await probe(input)
  if (type === 'photo') {
    if (!s) throw new Error('a photo needs watermark settings')
    await run(['ffmpeg', ...photoArgs(input, output, textFile, s, p)])
    return Bun.file(output).size
  }
  if (!s && p.codec === 'h264' && !p.hdr) {
    await run(['ffmpeg', ...remuxArgs(input, output, p)])
    if (Bun.file(output).size <= limit) return Bun.file(output).size
  }
  // Keep room for a second pass and the upload to storage, without moving the progress backwards.
  const encode = (cap: SizeCap | undefined, from: number, span: number) =>
    run(['ffmpeg', ...videoArgs(input, output, textFile, s, p, cap)], (line) => {
      const us = line.startsWith('out_time_us=') ? Number(line.slice(12)) : NaN
      if (p.duration && us > 0) onProgress(Math.min(from + span, Math.max(1, Math.floor(from + (span * us) / 1e6 / p.duration))))
    })
  await encode(undefined, 0, 90)
  if (Bun.file(output).size <= limit) return Bun.file(output).size
  await encode(sizeCap(p.duration, limit), 90, 9)
  const size = Bun.file(output).size
  if (size > limit) throw new TooLargeError(`still ${size} bytes`)
  return size
}
