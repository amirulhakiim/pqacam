import { expect, test } from 'bun:test'
import { hourLabel, insights } from '../src/lib/insights'
import type { Analytics } from '../src/server/analytics'

const base: Analytics = {
  days: 7,
  total: 10,
  previous: 8,
  allTime: 40,
  byDay: [
    { date: '2026-10-13', taps: 3 },
    { date: '2026-10-14', taps: 7 },
  ],
  byHour: Array.from({ length: 24 }, (_, h) => (h === 21 ? 6 : h === 9 ? 4 : 0)),
  byWeekday: [0, 3, 7, 0, 0, 0, 0],
  byPlatform: { shopee: 7, tiktok: 3, whatsapp: 0 },
  topProducts: [
    { id: 1, name: 'Tumbler', taps: 6 },
    { id: 2, name: 'Vase', taps: 4 },
  ],
  topLinks: [{ id: 5, name: 'Tumbler', platform: 'shopee', label: 'Set of 2', taps: 5 }],
  quiet: ['Bowl'],
}

test('hours read as a 12-hour clock', () => {
  expect([0, 9, 12, 21].map(hourLabel)).toEqual(['12 am', '9 am', '12 pm', '9 pm'])
})

test('insights state the trend, peak times, leaders and quiet products', () => {
  expect(insights(base)).toEqual([
    'Taps are up 25% on the previous 7 days (10 against 8).',
    'Most taps come between 9 pm and 10 pm: 60% of all taps.',
    'Wednesday is the busiest day of the week.',
    'The busiest single day was Wed, 14 Oct, with 7 taps.',
    'Shopee gets 70% of taps.',
    'Tumbler alone gets 60% of taps.',
    '"Set of 2" is the most-tapped option (Tumbler, Shopee).',
    '1 live product had no taps: Bowl.',
  ])
})

test('no taps, or nothing to compare with, is said plainly', () => {
  expect(insights({ ...base, total: 0 })).toEqual(['No taps in the last 7 days yet.'])
  expect(insights({ ...base, previous: 0 })[0]).toBe('10 taps, and none in the previous 7 days to compare with.')
})
