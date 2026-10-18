import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SHARE_HEIGHT, SHARE_WIDTH } from '../lib/share'
import { fontFile, run } from './watermark'

const CACHE = join(tmpdir(), 'pqacam-share')
const NAME_SIZE = 54
const NAME_LINE = 66
const PRICE_SIZE = 46
const PRICE_GAP = 34
const TEXT_X = 620
const rendering = new Map<string, Promise<string>>()
const RADIUS = 28
const corner = (pos: string, size: string) => `(${RADIUS}-(${size}/2-abs(${size}/2-${pos})))`
const ROUND = `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(max(0,${corner('X', 'W')}),max(0,${corner('Y', 'H')})),${RADIUS}),255,0)'`

export const drawable = (text: string) =>
  text
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}\p{Sc}\p{Sm}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

export function wrapLines(text: string, max: number, maxLines: number): string[] {
  const lines: string[] = []
  for (const word of text.split(' ').filter(Boolean)) {
    const last = lines.at(-1)
    if (last !== undefined && last.length + 1 + word.length <= max) lines[lines.length - 1] = `${last} ${word}`
    else for (let i = 0; i < word.length; i += max) lines.push(word.slice(i, i + max))
  }
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, max - 1).trimEnd()}…`
  return kept
}

export function shareArgs(input: string, output: string, files: { lines: string[]; price: string | null; site: string }): string[] {
  const block = files.lines.length * NAME_LINE + (files.price ? PRICE_GAP + PRICE_SIZE : 0)
  const top = Math.round((SHARE_HEIGHT - block) / 2) - 16
  const text = (file: string, font: string, size: number, y: number, color = 'white') =>
    `drawtext=fontfile='${font}':textfile='${file}':expansion=none:fontsize=${size}:fontcolor=${color}:x=${TEXT_X}:y=${y}`
  const draw = [
    ...files.lines.map((file, i) => text(file, fontFile('sans'), NAME_SIZE, top + i * NAME_LINE)),
    ...(files.price ? [text(files.price, fontFile('sans'), PRICE_SIZE, top + files.lines.length * NAME_LINE + PRICE_GAP)] : []),
    text(files.site, fontFile('sans'), 26, SHARE_HEIGHT - 66, 'white@0.75'),
  ]
  return [
    '-y',
    '-v',
    'error',
    '-i',
    input,
    '-filter_complex',
    `[0:v]scale=${SHARE_WIDTH}:${SHARE_HEIGHT}:force_original_aspect_ratio=increase,crop=${SHARE_WIDTH}:${SHARE_HEIGHT},gblur=sigma=40,eq=brightness=-0.28[bg];` +
      `[0:v]scale=500:550:force_original_aspect_ratio=decrease,format=rgba,${ROUND}[fg];` +
      `[bg][fg]overlay=x=60+(500-w)/2:y=(H-h)/2,${draw.join(',')}`,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    output,
  ]
}

async function render(coverUrl: string, title: string, price: string, site: string, output: string) {
  const dir = `${output}.work`
  await mkdir(dir, { recursive: true })
  try {
    const response = await fetch(coverUrl)
    if (!response.ok) throw new Error(`cover fetch failed: ${response.status}`)
    const input = join(dir, 'cover.jpg')
    await writeFile(input, new Uint8Array(await response.arrayBuffer()))
    const lines = wrapLines(drawable(title) || 'pqacam', 17, 3)
    const files = { lines: lines.map((_, i) => join(dir, `name${i}.txt`)), price: drawable(price) ? join(dir, 'price.txt') : null, site: join(dir, 'site.txt') }
    await Promise.all(lines.map((line, i) => writeFile(files.lines[i], line)))
    if (files.price) await writeFile(files.price, drawable(price))
    await writeFile(files.site, site)
    await run(['ffmpeg', ...shareArgs(input, join(dir, 'out.jpg'), files)])
    await rename(join(dir, 'out.jpg'), output)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function shareImage(id: number, version: string, coverUrl: string, title: string, price: string, site: string): Promise<string> {
  const output = join(CACHE, `${id}-${version}.jpg`)
  if (existsSync(output)) return output
  let job = rendering.get(output)
  if (!job) {
    job = render(coverUrl, title, price, site, output).then(() => output)
    rendering.set(output, job)
    void job.catch(() => {}).finally(() => rendering.delete(output))
  }
  return job
}
