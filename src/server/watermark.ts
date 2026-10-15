import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { WatermarkSettings } from './validate'

// Vite serves public/ in development. The Docker image has only the built copy.
const FONT_DIR = resolve(existsSync('public/fonts') ? 'public/fonts' : 'dist/client/fonts')
export const fontFile = (font: WatermarkSettings['font']) => `${FONT_DIR}/${font}.ttf`

// hdr is the transfer of an HDR video, or false for SDR.
export type Probe = { width: number; height: number; hdr: false | 'smpte2084' | 'arib-std-b67'; duration: number }
const MAX_EDGE = 1920
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

export function parseProbe(json: string): Probe {
  const data = JSON.parse(json)
  const v = (data.streams ?? []).find((s: { codec_type?: string }) => s.codec_type === 'video')
  if (!v) throw new Error('no video stream')
  const rotation = Number(v.side_data_list?.find((d: { rotation?: number }) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0)
  const turned = Math.abs(rotation) % 180 === 90
  return {
    width: turned ? v.height : v.width,
    height: turned ? v.width : v.height,
    hdr: ['smpte2084', 'arib-std-b67'].includes(v.color_transfer) ? v.color_transfer : false,
    duration: Number(data.format?.duration ?? v.duration ?? 0) || 0,
  }
}

// The size the output has after rotation and the 1080p cap, so the font size can follow the real width.
export function outputSize(p: Probe) {
  const k = Math.min(1, MAX_EDGE / Math.max(p.width, p.height))
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

export function videoArgs(input: string, output: string, textFile: string, s: WatermarkSettings, p: Probe): string[] {
  const out = outputSize(p)
  const filter = [p.hdr && tonemap(p.hdr), `scale=${out.width}:${out.height}`, drawtext(s, out.width, textFile, false)].filter(Boolean).join(',')
  return [
    ...['-hide_banner', '-nostats', '-y', '-i', input, '-vf', filter, '-map', '0:v:0', '-map', '0:a:0?'],
    // -map_metadata -1 drops the phone's GPS location and other tags.
    ...['-map_metadata', '-1', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p'],
    ...['-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-threads', '2', '-progress', 'pipe:1', output],
  ]
}

export function photoArgs(input: string, output: string, textFile: string, s: WatermarkSettings, p: Probe): string[] {
  return ['-hide_banner', '-nostats', '-y', '-i', input, '-vf', drawtext(s, p.width, textFile, true), '-map_metadata', '-1', '-q:v', '3', '-frames:v', '1', '-update', '1', output]
}

async function run(cmd: string[], onLine?: (line: string) => void): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
  const stderr = new Response(proc.stderr).text()
  let stdout = ''
  const decoder = new TextDecoder()
  for await (const chunk of proc.stdout) {
    const text = decoder.decode(chunk, { stream: true })
    stdout += text
    if (onLine) for (const line of text.split('\n')) onLine(line)
  }
  if ((await proc.exited) !== 0) throw new Error(`${cmd[0]} failed: ${(await stderr).trim().split('\n').slice(-3).join(' | ')}`)
  return stdout
}

export const probe = async (path: string) =>
  parseProbe(await run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]))

export async function watermarkFile(
  type: 'photo' | 'video',
  input: string,
  output: string,
  textFile: string,
  s: WatermarkSettings,
  onProgress: (percent: number) => void,
) {
  await Bun.write(textFile, s.text)
  const p = await probe(input)
  if (type === 'photo') return void (await run(['ffmpeg', ...photoArgs(input, output, textFile, s, p)]))
  await run(['ffmpeg', ...videoArgs(input, output, textFile, s, p)], (line) => {
    const us = line.startsWith('out_time_us=') ? Number(line.slice(12)) : NaN
    if (p.duration && us > 0) onProgress(Math.min(99, Math.floor(us / 1e4 / p.duration)))
  })
}
