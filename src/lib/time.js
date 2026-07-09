export const BUSINESS_START_HOUR = 9
export const BUSINESS_END_HOUR = 23

export function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd)
}

// Local-timezone-safe date key, e.g. "2026-07-20". Deliberately avoids
// Date#toISOString(), which converts to UTC first and shifts the date
// back a day for any positive UTC offset (e.g. Bangladesh, UTC+6).
export function toDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Inverse of toDateKey. Avoids `new Date(dateString)`, which parses
// "YYYY-MM-DD" as UTC midnight and can render as the wrong local day.
export function fromDateKey(key) {
  const [y, m, day] = key.split('-').map(Number)
  return new Date(y, m - 1, day)
}

export function formatTimeLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

// Explicit AM/PM-labeled time options, since native <input type="time">
// renders as a locale-dependent (often 24-hour, no AM/PM) picker on many
// phones.
export function generateTimeOptions(startHour = BUSINESS_START_HOUR, endHour = BUSINESS_END_HOUR, stepMinutes = 30) {
  const options = []
  for (let mins = startHour * 60; mins <= endHour * 60; mins += stepMinutes) {
    const h = String(Math.floor(mins / 60)).padStart(2, '0')
    const m = String(mins % 60).padStart(2, '0')
    const value = `${h}:${m}`
    options.push({ value, label: formatTimeLabel(value) })
  }
  return options
}
