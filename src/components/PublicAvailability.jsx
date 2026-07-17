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
import { PACKAGES, ADVANCE_PERCENT, PAYMENT_INFO, buildWhatsAppLink } from '../lib/packages.js'
import { isValidBangladeshiPhone, isValidClientName } from '../lib/validation.js'

const DAY_START_HOUR = BUSINESS_START_HOUR
const DAY_END_HOUR = BUSINESS_END_HOUR
const TIME_OPTIONS = generateTimeOptions()

const HOUR_TICKS = [9, 12, 15, 18, 21, 23]
const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/* ---------------------------------------------------------------
   Small inline icon set (Feather-style strokes, no dependency)
--------------------------------------------------------------- */
function IconClock(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
function IconCalendar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
function IconChevronLeft(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
function IconChevronRight(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
function IconCamera(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
function IconVideo(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}
function IconMessage(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function IconCheckCircle(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
function IconAlert(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
function IconSend(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

const PACKAGE_ICONS = { photoshoot: IconCamera, photo_video: IconVideo, custom: IconMessage }

function inputClass() {
  return 'w-full border border-mist rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15'
}

function FieldLabel({ children }) {
  return <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink/45 mb-1">{children}</span>
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

const emptyRequestForm = { start_time: '', end_time: '', client_name: '', client_phone: '' }

export default function PublicAvailability() {
  const [monthStart, setMonthStart] = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()))
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestForm, setRequestForm] = useState(emptyRequestForm)
  const [requestError, setRequestError] = useState('')
  const [requestSuccess, setRequestSuccess] = useState('')
  const [requestSaving, setRequestSaving] = useState(false)
  const [paymentTab, setPaymentTab] = useState('mobile')

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
      setError(error.message || 'Unknown error')
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

  const selectedPackage = PACKAGES.find((p) => p.id === selectedPackageId) || null

  const priceInfo = useMemo(() => {
    if (!selectedPackage || !selectedPackage.hourlyRate) return null
    const { start_time, end_time } = requestForm
    if (!start_time || !end_time) return null
    const minutes = timeToMinutes(end_time) - timeToMinutes(start_time)
    if (minutes <= 0) return null
    const hours = minutes / 60
    const total = hours * selectedPackage.hourlyRate
    const advance = Math.round((total * ADVANCE_PERCENT) / 100)
    return { hours, total, advance }
  }, [selectedPackage, requestForm.start_time, requestForm.end_time])

  const whatsAppMessage = useMemo(() => {
    let msg = "Hello, I'd like to inquire about booking a shoot at 4R Studio."
    if (selectedDate) {
      msg += ` Date: ${fromDateKey(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
    }
    if (requestForm.start_time && requestForm.end_time) {
      const startLabel = TIME_OPTIONS.find((t) => t.value === requestForm.start_time)?.label
      const endLabel = TIME_OPTIONS.find((t) => t.value === requestForm.end_time)?.label
      if (startLabel && endLabel) msg += `, Time: ${startLabel} – ${endLabel}`
    }
    return msg
  }, [selectedDate, requestForm.start_time, requestForm.end_time])

  function openRequestForm() {
    setRequestError('')
    setRequestSuccess('')
    setRequestForm(emptyRequestForm)
    setRequestOpen(true)
  }

  async function handleSubmitRequest(e) {
    e.preventDefault()
    setRequestError('')

    if (!selectedPackage || !selectedPackage.hourlyRate) return

    const { start_time, end_time, client_name, client_phone } = requestForm
    if (!start_time || !end_time || !client_name || !client_phone) {
      setRequestError('Please enter your name, phone, and time')
      return
    }
    if (!isValidClientName(client_name)) {
      setRequestError('Please enter a valid name')
      return
    }
    if (!isValidBangladeshiPhone(client_phone)) {
      setRequestError('Please enter a valid Bangladeshi phone number (e.g. 01712345678)')
      return
    }
    if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
      setRequestError('Start time must be before end time')
      return
    }
    const clash = dayBookings.find((b) => overlaps(start_time, end_time, b.start_time, b.end_time))
    if (clash) {
      setRequestError(`This time is already booked (${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)}), please choose another time`)
      return
    }

    const packageName = priceInfo
      ? `${selectedPackage.label} (${selectedPackage.rateLabel}) — ${priceInfo.hours} hr = ${priceInfo.total} Tk, advance ${priceInfo.advance} Tk`
      : selectedPackage.label

    setRequestSaving(true)
    const { error } = await supabase.from('bookings').insert({
      booking_date: selectedDate,
      start_time,
      end_time,
      client_name,
      client_phone,
      package_name: packageName,
      status: 'pending',
    })
    setRequestSaving(false)

    if (error) {
      if (error.code === '23P01') {
        setRequestError('Sorry, this slot was just booked. Please choose another time.')
      } else {
        setRequestError('Could not send request: ' + error.message)
      }
      return
    }

    setRequestOpen(false)
    setRequestForm(emptyRequestForm)
    setRequestSuccess(
      "Your request has been sent. We'll contact you shortly to confirm the booking. Message us on WhatsApp if you need to change the date/time."
    )
    loadBookings()
  }

  return (
    <div className="max-w-md mx-auto">
      {error && (
        <div className="flex items-start gap-2 mb-4 text-sm text-clay bg-clay/10 border border-clay/20 rounded-xl px-3.5 py-3">
          <IconAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p>Could not load bookings. Please try again.</p>
            <p className="text-xs text-clay/70 mt-1">Details: {error}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 mb-5 text-ink/70">
        <IconClock className="h-4 w-4" />
        <p className="text-sm font-semibold">Opening Hours: {DAY_START_HOUR} AM – {DAY_END_HOUR - 12} PM</p>
      </div>

      {/* Month calendar card */}
      <div className="bg-white rounded-2xl border border-mist/70 shadow-sm p-3.5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              setMonthStart(addMonths(monthStart, -1))
              setSelectedDate(null)
            }}
            aria-label="Previous month"
            className="flex items-center justify-center h-9 w-9 rounded-full text-ink/60 hover:bg-mist/40 hover:text-ink transition-colors"
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>
          <p className="font-display text-lg text-ink flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-pine" />
            {monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
          <button
            onClick={() => {
              setMonthStart(addMonths(monthStart, 1))
              setSelectedDate(null)
            }}
            aria-label="Next month"
            className="flex items-center justify-center h-9 w-9 rounded-full text-ink/60 hover:bg-mist/40 hover:text-ink transition-colors"
          >
            <IconChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {WEEKDAY_LABELS.map((label) => (
            <p key={label} className="text-center text-[10px] uppercase tracking-wide text-ink/40 font-semibold py-1">
              {label}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
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
                className={`flex flex-col items-center justify-center rounded-xl py-2.5 border transition-all ${
                  isSelected
                    ? 'bg-ink text-paper border-ink shadow-md'
                    : isPast
                    ? 'bg-mist/20 text-ink/25 border-transparent'
                    : isToday
                    ? 'bg-pine/5 text-ink border-pine/50'
                    : 'bg-white text-ink border-mist/70 hover:border-pine/40 hover:shadow-sm'
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

        <div className="flex items-center justify-center gap-4 mt-3.5 pt-3 border-t border-mist/60 text-[11px] text-ink/50">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-pine/40" /> Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-clay" /> Booked
          </span>
        </div>
      </div>

      {/* Package selector */}
      <p className="text-[11px] uppercase tracking-wide text-ink/45 font-semibold mb-2 px-0.5">Choose a Package</p>
      <div className="grid gap-2 mb-5">
        {PACKAGES.map((p) => {
          const isSelected = selectedPackageId === p.id
          const Icon = PACKAGE_ICONS[p.id] || IconMessage
          return (
            <button
              key={p.id}
              onClick={() => setSelectedPackageId(p.id)}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 border text-left transition-all ${
                isSelected
                  ? 'bg-pine border-pine text-paper shadow-md'
                  : 'bg-white border-mist/70 text-ink shadow-sm hover:border-pine/40 hover:shadow-md'
              }`}
            >
              <span
                className={`flex items-center justify-center h-9 w-9 rounded-full shrink-0 ${
                  isSelected ? 'bg-white/15 text-paper' : 'bg-pine/10 text-pine'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="flex-1 text-sm font-medium">{p.label}</span>
              <span className={`text-xs font-semibold shrink-0 ${isSelected ? 'text-paper/90' : 'text-ink/70'}`}>
                {p.rateLabel || 'WhatsApp'}
              </span>
              {isSelected && <IconCheck className="h-4 w-4 shrink-0" />}
            </button>
          )
        })}
      </div>

      {/* Day detail */}
      {!selectedDate ? (
        <p className="text-sm text-ink/40 py-6 text-center">Select a date</p>
      ) : (
        <div className="bg-white border border-mist/70 shadow-sm rounded-2xl p-4">
          <p className="font-display text-lg mb-3 flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-pine" />
            {fromDateKey(selectedDate).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>

          {loading ? (
            <p className="text-sm text-ink/40 py-6 text-center">Loading…</p>
          ) : (
            <div>
              {/* Timeline — always visible so business hours are always clear */}
              <div className="relative h-2.5 bg-mist/40 rounded-full overflow-hidden mb-1.5">
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
                <p className="flex items-center justify-center gap-1.5 text-sm text-pine font-medium py-3 text-center bg-pine/5 rounded-xl mb-4">
                  <IconCheckCircle className="h-4 w-4" /> Fully available
                </p>
              ) : (
                <ul className="space-y-2 mb-4">
                  {dayBookings.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between text-sm bg-clay/5 border border-clay/15 rounded-xl px-3.5 py-2.5"
                    >
                      <span className="font-medium text-ink/80">
                        {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                      </span>
                      <span className="text-ink/50 text-xs font-medium">Booked</span>
                    </li>
                  ))}
                </ul>
              )}

              {isSelectedPast ? null : requestSuccess ? (
                <p className="flex items-start gap-2 text-sm text-pine bg-pine/5 border border-pine/20 rounded-xl px-3.5 py-3">
                  <IconCheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {requestSuccess}
                </p>
              ) : !requestOpen ? (
                <button
                  onClick={openRequestForm}
                  className="w-full bg-pine text-paper rounded-xl py-3 font-semibold shadow-sm hover:opacity-95 transition-opacity"
                >
                  Book this slot
                </button>
              ) : (
                <form onSubmit={handleSubmitRequest} className="border border-mist/70 rounded-2xl p-4 bg-paper/40">
                  <p className="text-base font-display mb-3">Booking Request</p>

                  {!selectedPackage ? (
                    <>
                      <p className="text-xs text-ink/60 mb-3">Please select a package above.</p>
                      <button
                        type="button"
                        onClick={() => setRequestOpen(false)}
                        className="w-full border border-mist rounded-xl py-2.5 text-sm font-medium text-ink/60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <FieldLabel>Time</FieldLabel>
                      <div className="grid grid-cols-2 gap-2 mb-3.5">
                        <select
                          value={requestForm.start_time}
                          onChange={(e) => setRequestForm({ ...requestForm, start_time: e.target.value })}
                          className={inputClass()}
                        >
                          <option value="">From</option>
                          {TIME_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <select
                          value={requestForm.end_time}
                          onChange={(e) => setRequestForm({ ...requestForm, end_time: e.target.value })}
                          className={inputClass()}
                        >
                          <option value="">To</option>
                          {TIME_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {selectedPackageId === 'custom' ? (
                        <div>
                          <p className="text-xs text-ink/60 mb-2.5">
                            Contact us on WhatsApp to discuss packages and pricing for this type of shoot.
                          </p>
                          <a
                            href={buildWhatsAppLink(whatsAppMessage)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 text-center bg-[#25D366] text-white rounded-xl py-3 text-sm font-semibold shadow-sm"
                          >
                            <IconMessage className="h-4 w-4" />
                            Contact on WhatsApp
                          </a>
                        </div>
                      ) : (
                        <>
                          {priceInfo && (
                            <div className="grid grid-cols-2 gap-2 mb-3.5">
                              <div className="rounded-xl bg-pine/5 border border-pine/15 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-ink/40 font-semibold mb-0.5">Total</p>
                                <p className="text-sm font-semibold text-ink">{priceInfo.total} Tk</p>
                              </div>
                              <div className="rounded-xl bg-clay/5 border border-clay/20 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-ink/40 font-semibold mb-0.5">
                                  Advance ({ADVANCE_PERCENT}%)
                                </p>
                                <p className="text-sm font-semibold text-clay">{priceInfo.advance} Tk</p>
                              </div>
                            </div>
                          )}

                          <FieldLabel>Your Details</FieldLabel>
                          <div className="space-y-2 mb-3.5">
                            <input
                              type="text"
                              placeholder="Your name"
                              value={requestForm.client_name}
                              onChange={(e) => setRequestForm({ ...requestForm, client_name: e.target.value })}
                              className={inputClass()}
                            />
                            <input
                              type="tel"
                              placeholder="Phone number"
                              value={requestForm.client_phone}
                              onChange={(e) => setRequestForm({ ...requestForm, client_phone: e.target.value })}
                              className={inputClass()}
                            />
                          </div>

                          {priceInfo && (
                            <div className="flex items-start gap-2 rounded-xl bg-clay/5 border border-clay/20 px-3.5 py-2.5 mb-3.5">
                              <IconAlert className="h-4 w-4 text-clay shrink-0 mt-0.5" />
                              <p className="text-xs text-clay font-medium">
                                Paying the {ADVANCE_PERCENT}% advance is mandatory to confirm your booking.
                              </p>
                            </div>
                          )}

                          {priceInfo && (
                            <div className="mb-3.5">
                              <FieldLabel>Payment Details</FieldLabel>
                              <div className="flex bg-mist/30 rounded-xl p-1 mb-2">
                                <button
                                  type="button"
                                  onClick={() => setPaymentTab('mobile')}
                                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                                    paymentTab === 'mobile' ? 'bg-white text-pine shadow-sm' : 'text-ink/50'
                                  }`}
                                >
                                  bKash / Nagad
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaymentTab('bank')}
                                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                                    paymentTab === 'bank' ? 'bg-white text-pine shadow-sm' : 'text-ink/50'
                                  }`}
                                >
                                  Bank
                                </button>
                              </div>
                              <div className="rounded-xl bg-white border border-mist/60 px-3.5 py-2.5 text-xs text-ink/70 space-y-0.5">
                                {paymentTab === 'mobile' ? (
                                  <p>
                                    Send Money to <span className="font-semibold text-ink">{PAYMENT_INFO.mobileBankingNumber}</span> ({PAYMENT_INFO.mobileBankingType})
                                  </p>
                                ) : (
                                  <>
                                    <p className="font-semibold text-ink">{PAYMENT_INFO.bank.accountName}</p>
                                    <p>A/C: {PAYMENT_INFO.bank.accountNumber}</p>
                                    <p>{PAYMENT_INFO.bank.bankName}, {PAYMENT_INFO.bank.branchName} Branch</p>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {requestError && (
                            <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3.5 py-2.5 mb-3.5">
                              <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              {requestError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setRequestOpen(false)}
                              className="flex-1 border border-mist rounded-xl py-2.5 text-sm font-medium text-ink/60"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={requestSaving}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-pine text-paper rounded-xl py-2.5 text-sm font-semibold shadow-sm disabled:opacity-50"
                            >
                              {requestSaving ? 'Sending…' : (<><IconSend className="h-3.5 w-3.5" /> Send Request</>)}
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-ink/40 mt-5 text-center leading-relaxed">
        We'll contact you to confirm your booking after you send a request. Client names aren't shown publicly on this page.
        Message us on WhatsApp if you need to change the date/time:{' '}
        <a href={buildWhatsAppLink(whatsAppMessage)} target="_blank" rel="noreferrer" className="underline text-ink/60 hover:text-ink">
          Contact on WhatsApp
        </a>
        .
      </p>
    </div>
  )
}
