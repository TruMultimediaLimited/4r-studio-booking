import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'

// Business hours shown on the timeline. Adjust if 4R Studio's hours differ.
const DAY_START_HOUR = 9
const DAY_END_HOUR = 23

function toDateKey(d) {
  return d.toISOString().slice(0, 10)
}

function addDays(d, n) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

function startOfWeek(d) {
  const copy = new Date(d)
  const day = copy.getDay()
  copy.setDate(copy.getDate() - day)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function PublicAvailability() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()))
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()))
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  useEffect(() => {
    async function loadBookings() {
      setLoading(true)
      setError(null)
      const rangeStart = toDateKey(weekStart)
      const rangeEnd = toDateKey(addDays(weekStart, 7))
      const { data, error } = await supabase
        .from('public_bookings')
        .select('*')
        .gte('booking_date', rangeStart)
        .lt('booking_date', rangeEnd)
        .neq('status', 'cancelled')
      if (error) {
        setError('বুকিং লোড করা যায়নি। আবার চেষ্টা করুন।')
        setLoading(false)
        return
      }
      setBookings(data || [])
      setLoading(false)
    }
    loadBookings()
  }, [weekStart])

  const dayBookings = bookings
    .filter((b) => b.booking_date === selectedDate)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const bookingsByDate = useMemo(() => {
    const map = {}
    for (const b of bookings) {
      map[b.booking_date] = (map[b.booking_date] || 0) + 1
    }
    return map
  }, [bookings])

  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60

  return (
    <div>
      {error && (
        <div className="mb-4 text-sm text-clay bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="text-sm text-ink/60 px-2 py-1 hover:text-ink"
        >
          ← আগের সপ্তাহ
        </button>
        <p className="font-display text-sm text-ink/70">
          {weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –{' '}
          {weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </p>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="text-sm text-ink/60 px-2 py-1 hover:text-ink"
        >
          পরের সপ্তাহ →
        </button>
      </div>

      {/* Week strip — the light-table filmstrip */}
      <div className="grid grid-cols-7 gap-1.5 mb-6">
        {weekDays.map((d) => {
          const key = toDateKey(d)
          const count = bookingsByDate[key] || 0
          const isSelected = key === selectedDate
          const isPast = key < toDateKey(new Date())
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(key)}
              disabled={isPast}
              className={`flex flex-col items-center rounded-xl py-3 border transition-colors ${
                isSelected
                  ? 'bg-ink text-paper border-ink'
                  : isPast
                  ? 'bg-mist/30 text-ink/25 border-mist/50'
                  : 'bg-white text-ink border-mist hover:border-pine/50'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wide opacity-70">
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </span>
              <span className="font-display text-lg leading-tight">{d.getDate()}</span>
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  count > 0 ? 'bg-clay' : isPast ? 'bg-transparent' : 'bg-pine/40'
                }`}
              />
            </button>
          )
        })}
      </div>

      {/* Day timeline */}
      <div className="bg-white border border-mist rounded-2xl p-4">
        <p className="font-display text-lg mb-3">
          {new Date(selectedDate).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>

        {loading ? (
          <p className="text-sm text-ink/40 py-6 text-center">লোড হচ্ছে…</p>
        ) : dayBookings.length === 0 ? (
          <p className="text-sm text-pine py-6 text-center bg-pine/5 rounded-xl">
            পুরো দিন খালি আছে
          </p>
        ) : (
          <div>
            {/* Visual bar */}
            <div className="relative h-3 bg-mist/40 rounded-full overflow-hidden mb-4">
              {dayBookings.map((b) => {
                const start = Math.max(timeToMinutes(b.start_time) - DAY_START_HOUR * 60, 0)
                const end = Math.min(timeToMinutes(b.end_time) - DAY_START_HOUR * 60, totalMinutes)
                const left = (start / totalMinutes) * 100
                const width = ((end - start) / totalMinutes) * 100
                return (
                  <div
                    key={b.id}
                    className="absolute top-0 h-full bg-clay/80"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] text-ink/40 mb-4 -mt-2">
              <span>{DAY_START_HOUR}:00</span>
              <span>{DAY_END_HOUR}:00</span>
            </div>

            {/* List of booked slots */}
            <ul className="space-y-2">
              {dayBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between text-sm bg-clay/5 border border-clay/15 rounded-lg px-3 py-2"
                >
                  <span className="font-medium text-ink/80">
                    {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                  </span>
                  <span className="text-ink/50 text-xs">বুকড</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-xs text-ink/40 mt-4 text-center">
        সময় খালি থাকলে বুকিং কনফার্ম করতে মেসেজ করুন। এই পেজে শুধু খালি/বুকড দেখা যায়।
      </p>
    </div>
  )
}
