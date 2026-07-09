import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import {
  timeToMinutes,
  overlaps,
  toDateKey,
  fromDateKey,
  generateTimeOptions,
  BUSINESS_START_HOUR,
  BUSINESS_END_HOUR,
} from '../lib/time.js'

const DAY_START_HOUR = BUSINESS_START_HOUR
const DAY_END_HOUR = BUSINESS_END_HOUR
const TIME_OPTIONS = generateTimeOptions()

const HOUR_TICKS = [9, 12, 15, 18, 21, 23]
const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

const emptyRequestForm = { start_time: '', end_time: '', client_name: '', client_phone: '', package_name: '' }

export default function PublicAvailability() {
  const [monthStart, setMonthStart] = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()))
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [requestOpen, setRequestOpen] = useState(false)
  const [requestForm, setRequestForm] = useState(emptyRequestForm)
  const [requestError, setRequestError] = useState('')
  const [requestSuccess, setRequestSuccess] = useState('')
  const [requestSaving, setRequestSaving] = useState(false)

  const monthCells = useMemo(() => {
    const totalDays = daysInMonth(monthStart)
    const leadingBlanks = startOfMonth(monthStart).getDay()
    const cells = Array.from({ length: leadingBlanks }, () => null)
    for (let day = 1; day <= totalDays; day++) {
      cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day))
    }
    return cells
  }, [monthStart])

  async function loadBookings() {
    setLoading(true)
    setError(null)
    const rangeStart = toDateKey(startOfMonth(monthStart))
    const rangeEnd = toDateKey(addMonths(monthStart, 1))
    const { data, error } = await supabase
      .from('public_bookings')
      .select('*')
      .gte('booking_date', rangeStart)
      .lt('booking_date', rangeEnd)
    if (error) {
      setError('বুকিং লোড করা যায়নি। আবার চেষ্টা করুন।')
      setLoading(false)
      return
    }
    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart])

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
  const todayKey = toDateKey(new Date())
  const isSelectedPast = selectedDate && selectedDate < todayKey

  function openRequestForm() {
    setRequestError('')
    setRequestSuccess('')
    setRequestForm(emptyRequestForm)
    setRequestOpen(true)
  }

  async function handleSubmitRequest(e) {
    e.preventDefault()
    setRequestError('')

    const { start_time, end_time, client_name, client_phone } = requestForm
    if (!start_time || !end_time || !client_name || !client_phone) {
      setRequestError('নাম, ফোন ও সময় দিন')
      return
    }
    if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
      setRequestError('শুরুর সময় শেষের সময়ের আগে হতে হবে')
      return
    }
    const clash = dayBookings.find((b) => overlaps(start_time, end_time, b.start_time, b.end_time))
    if (clash) {
      setRequestError(`এই সময় ইতিমধ্যে বুকড (${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)}), অন্য সময় বেছে নিন`)
      return
    }

    setRequestSaving(true)
    const { error } = await supabase.from('bookings').insert({
      booking_date: selectedDate,
      start_time,
      end_time,
      client_name,
      client_phone,
      package_name: requestForm.package_name || null,
      status: 'pending',
    })
    setRequestSaving(false)

    if (error) {
      if (error.code === '23P01') {
        setRequestError('দুঃখিত, এই সময়টা এইমাত্র বুক হয়ে গেছে। অন্য সময় বেছে নিন।')
      } else {
        setRequestError('রিকোয়েস্ট পাঠানো যায়নি: ' + error.message)
      }
      return
    }

    setRequestOpen(false)
    setRequestForm(emptyRequestForm)
    setRequestSuccess('আপনার রিকোয়েস্ট পাঠানো হয়েছে। আমরা শীঘ্রই যোগাযোগ করে বুকিং কনফার্ম করব।')
    loadBookings()
  }

  return (
    <div>
      {error && (
        <div className="mb-4 text-sm text-clay bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <p className="text-xs text-ink/50 text-center mb-4">
        কাজের সময়: সকাল {DAY_START_HOUR}টা – রাত {DAY_END_HOUR - 12}টা
      </p>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => {
            setMonthStart(addMonths(monthStart, -1))
            setSelectedDate(null)
          }}
          className="text-sm text-ink/60 px-2 py-1 hover:text-ink"
        >
          ← আগের মাস
        </button>
        <p className="font-display text-base text-ink/80">
          {monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
        <button
          onClick={() => {
            setMonthStart(addMonths(monthStart, 1))
            setSelectedDate(null)
          }}
          className="text-sm text-ink/60 px-2 py-1 hover:text-ink"
        >
          পরের মাস →
        </button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAY_LABELS.map((label) => (
          <p key={label} className="text-center text-[10px] uppercase tracking-wide text-ink/40 py-1">
            {label}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-6">
        {monthCells.map((d, i) => {
          if (!d) return <div key={`blank-${i}`} />
          const key = toDateKey(d)
          const count = bookingsByDate[key] || 0
          const isSelected = key === selectedDate
          const isPast = key < todayKey
          const isToday = key === todayKey
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(key)}
              disabled={isPast}
              className={`flex flex-col items-center justify-center rounded-lg py-2 border transition-colors ${
                isSelected
                  ? 'bg-ink text-paper border-ink'
                  : isPast
                  ? 'bg-mist/30 text-ink/25 border-mist/50'
                  : isToday
                  ? 'bg-white text-ink border-pine'
                  : 'bg-white text-ink border-mist hover:border-pine/50'
              }`}
            >
              <span className="font-display text-sm leading-tight">{d.getDate()}</span>
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  count > 0 ? 'bg-clay' : isPast ? 'bg-transparent' : 'bg-pine/40'
                }`}
              />
            </button>
          )
        })}
      </div>

      {/* Day detail */}
      {!selectedDate ? (
        <p className="text-sm text-ink/40 py-6 text-center">একটি তারিখ সিলেক্ট করুন</p>
      ) : (
        <div className="bg-white border border-mist rounded-2xl p-4">
          <p className="font-display text-lg mb-3">
            {fromDateKey(selectedDate).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>

          {loading ? (
            <p className="text-sm text-ink/40 py-6 text-center">লোড হচ্ছে…</p>
          ) : (
            <div>
              {/* Timeline — always visible so business hours are always clear */}
              <div className="relative h-3 bg-mist/40 rounded-full overflow-hidden mb-1">
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
              <div className="flex justify-between text-[10px] text-ink/40 mb-4">
                {HOUR_TICKS.map((h) => (
                  <span key={h}>{h > 12 ? h - 12 : h}{h >= 12 ? 'pm' : 'am'}</span>
                ))}
              </div>

              {dayBookings.length === 0 ? (
                <p className="text-sm text-pine py-3 text-center bg-pine/5 rounded-xl mb-4">
                  পুরো দিন খালি আছে
                </p>
              ) : (
                <ul className="space-y-2 mb-4">
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
              )}

              {isSelectedPast ? null : requestSuccess ? (
                <p className="text-sm text-pine bg-pine/5 border border-pine/20 rounded-lg px-3 py-2 text-center">
                  {requestSuccess}
                </p>
              ) : !requestOpen ? (
                <button
                  onClick={openRequestForm}
                  className="w-full bg-pine text-paper rounded-lg py-2 font-medium"
                >
                  এই সময়টা বুক করতে চাই
                </button>
              ) : (
                <form onSubmit={handleSubmitRequest} className="border border-mist rounded-xl p-3">
                  <p className="text-sm font-medium mb-2">বুকিং রিকোয়েস্ট</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select
                      value={requestForm.start_time}
                      onChange={(e) => setRequestForm({ ...requestForm, start_time: e.target.value })}
                      className="border border-mist rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">শুরুর সময়</option>
                      {TIME_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <select
                      value={requestForm.end_time}
                      onChange={(e) => setRequestForm({ ...requestForm, end_time: e.target.value })}
                      className="border border-mist rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">শেষের সময়</option>
                      {TIME_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="আপনার নাম"
                      value={requestForm.client_name}
                      onChange={(e) => setRequestForm({ ...requestForm, client_name: e.target.value })}
                      className="col-span-2 border border-mist rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="tel"
                      placeholder="ফোন নম্বর"
                      value={requestForm.client_phone}
                      onChange={(e) => setRequestForm({ ...requestForm, client_phone: e.target.value })}
                      className="col-span-2 border border-mist rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="আগ্রহী প্যাকেজ (ঐচ্ছিক)"
                      value={requestForm.package_name}
                      onChange={(e) => setRequestForm({ ...requestForm, package_name: e.target.value })}
                      className="col-span-2 border border-mist rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  {requestError && (
                    <p className="text-xs text-clay bg-clay/10 border border-clay/20 rounded-lg px-3 py-2 mb-2">
                      {requestError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestOpen(false)}
                      className="flex-1 border border-mist rounded-lg py-2 text-sm font-medium text-ink/60"
                    >
                      বাতিল
                    </button>
                    <button
                      disabled={requestSaving}
                      className="flex-1 bg-pine text-paper rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                    >
                      {requestSaving ? 'পাঠানো হচ্ছে…' : 'রিকোয়েস্ট পাঠান'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-ink/40 mt-4 text-center">
        রিকোয়েস্ট পাঠালে আমরা যোগাযোগ করে বুকিং কনফার্ম করব। এই পেজে ক্লায়েন্টের নাম কারো কাছে দেখা যায় না।
      </p>
    </div>
  )
}
