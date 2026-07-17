import { describe, it, expect } from 'vitest'
import {
  timeToMinutes,
  overlaps,
  toDateKey,
  fromDateKey,
  formatTimeLabel,
  generateTimeOptions,
} from './time.js'

describe('timeToMinutes', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('09:30')).toBe(570)
    expect(timeToMinutes('23:00')).toBe(1380)
  })

  it('handles seconds-bearing values from the database (HH:MM:SS)', () => {
    expect(timeToMinutes('09:30:00')).toBe(570)
  })
})

describe('overlaps', () => {
  it('detects overlapping ranges', () => {
    expect(overlaps('09:00', '11:00', '10:00', '12:00')).toBe(true)
    expect(overlaps('10:00', '12:00', '09:00', '11:00')).toBe(true)
    expect(overlaps('09:00', '12:00', '10:00', '11:00')).toBe(true)
  })

  it('treats touching ranges as non-overlapping (back-to-back bookings allowed)', () => {
    expect(overlaps('09:00', '10:00', '10:00', '11:00')).toBe(false)
    expect(overlaps('10:00', '11:00', '09:00', '10:00')).toBe(false)
  })

  it('returns false for disjoint ranges', () => {
    expect(overlaps('09:00', '10:00', '11:00', '12:00')).toBe(false)
  })
})

describe('toDateKey / fromDateKey', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('round-trips through fromDateKey', () => {
    const key = '2026-07-18'
    expect(toDateKey(fromDateKey(key))).toBe(key)
  })

  it('does not shift the date across the UTC boundary (UTC+6 regression)', () => {
    // Midnight local time used to render as the previous day via toISOString().
    const midnight = new Date(2026, 6, 18, 0, 0, 0)
    expect(toDateKey(midnight)).toBe('2026-07-18')
  })
})

describe('formatTimeLabel', () => {
  it('formats morning, noon, afternoon and midnight correctly', () => {
    expect(formatTimeLabel('09:00')).toBe('9:00 AM')
    expect(formatTimeLabel('12:00')).toBe('12:00 PM')
    expect(formatTimeLabel('13:30')).toBe('1:30 PM')
    expect(formatTimeLabel('23:00')).toBe('11:00 PM')
    expect(formatTimeLabel('00:00')).toBe('12:00 AM')
  })
})

describe('generateTimeOptions', () => {
  it('generates 30-minute steps from start to end inclusive', () => {
    const options = generateTimeOptions(9, 11)
    expect(options.map((o) => o.value)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00'])
  })

  it('labels options with AM/PM', () => {
    const options = generateTimeOptions(12, 13)
    expect(options[0].label).toBe('12:00 PM')
    expect(options.at(-1).label).toBe('1:00 PM')
  })

  it('uses business defaults when no range is given', () => {
    const options = generateTimeOptions()
    expect(options[0].value).toBe('09:00')
    expect(options.at(-1).value).toBe('23:00')
  })
})
