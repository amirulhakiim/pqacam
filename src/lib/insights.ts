import type { Analytics } from '../server/analytics'
import { PLATFORM_LABEL } from './platforms'

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`
export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const share = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`
const most = (list: number[]) => list.indexOf(Math.max(...list))

export function insights(a: Analytics): string[] {
  const out: string[] = []
  const period = `the previous ${a.days} days`
  if (a.total === 0) return [`No taps in the last ${a.days} days yet.`]
  if (a.previous === 0) out.push(`${a.total} taps, and none in ${period} to compare with.`)
  else {
    const change = Math.round(((a.total - a.previous) / a.previous) * 100)
    out.push(
      change === 0
        ? `Taps are level with ${period} (${a.total}).`
        : `Taps are ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% on ${period} (${a.total} against ${a.previous}).`,
    )
  }
  const hour = most(a.byHour)
  out.push(`Most taps come between ${hourLabel(hour)} and ${hourLabel((hour + 1) % 24)}: ${share(a.byHour[hour], a.total)} of all taps.`)
  out.push(`${WEEKDAYS[most(a.byWeekday)]} is the busiest day of the week.`)
  const peak = a.byDay.reduce((best, d) => (d.taps > best.taps ? d : best))
  out.push(`The busiest single day was ${dayLabel(peak.date)}, with ${peak.taps} tap${peak.taps === 1 ? '' : 's'}.`)
  const [platform, taps] = Object.entries(a.byPlatform).sort((x, y) => y[1] - x[1])[0] as [keyof typeof PLATFORM_LABEL, number]
  out.push(`${PLATFORM_LABEL[platform].chip} gets ${share(taps, a.total)} of taps.`)
  const [product] = a.topProducts
  if (product && a.topProducts.length > 1) out.push(`${product.name} alone gets ${share(product.taps, a.total)} of taps.`)
  const option = a.topLinks.find((l) => l.label && l.platform)
  if (option?.platform) out.push(`"${option.label}" is the most-tapped option (${option.name}, ${PLATFORM_LABEL[option.platform].chip}).`)
  if (a.quiet.length) {
    const names = a.quiet.slice(0, 3).join(', ') + (a.quiet.length > 3 ? ` and ${a.quiet.length - 3} more` : '')
    out.push(`${a.quiet.length} live product${a.quiet.length === 1 ? '' : 's'} had no taps: ${names}.`)
  }
  return out
}
