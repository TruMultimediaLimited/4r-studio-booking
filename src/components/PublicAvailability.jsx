import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import {
  timeToMinutes,
  overlaps,
  toDateKey,
  fromDateKey,
  formatTimeLabel,
  generateTimeOptions,
  BUSINESS_START_HOUR,
  BUSINESS_END_HOUR,
} from '../lib/time.js'
import { PACKAGES, ADVANCE_PERCENT, PAYMENT_INFO, buildWhatsAppLink } from '../lib/packages.js'
import { isValidBangladeshiPhone, isValidClientName } from '../lib/validation.js'

const DAY_START_HOUR = BUSINESS_START_HOUR
const DAY_END_HOUR = BUSINESS_END_HOUR
const TIME_OPTIONS = generateTimeOptions()
// A booking can't start at closing time (no room left to end), so the
// "From" list drops the final (closing-time) option; "To" keeps it.
const FROM_TIME_OPTIONS = TIME_OPTIONS.slice(0, -1)

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/* ---------------------------------------------------------------
   Small inline icon set (Feather-style strokes, no dependency)
--------------------------------------------------------------- */
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
  return 'w-full border border-[#E0E0E0] rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15'
}

function FieldLabel({ children }) {
  return <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#333333]/55 mb-1">{children}</span>
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

  function markBookedStatus(options) {
    return options.map((opt) => {
      const t = timeToMinutes(opt.value)
      const isBooked = dayBookings.some((b) => t >= timeToMinutes(b.start_time) && t < timeToMinutes(b.end_time))
      return { ...opt, disabled: isBooked, label: isBooked ? `${opt.label} (Booked)` : opt.label }
    })
  }

  // "From" excludes the last option (closing time) — a booking can't start
  // exactly when the studio closes, since there'd be no room left to end.
  const fromTimeOptions = useMemo(
    () => markBookedStatus(FROM_TIME_OPTIONS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayBookings]
  )
  const toTimeOptions = useMemo(
    () => markBookedStatus(TIME_OPTIONS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayBookings]
  )

  const availabilityStatus = useMemo(() => {
    const { start_time, end_time } = requestForm
    if (!start_time || !end_time) return null
    if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
      return { kind: 'warn', text: 'End time must be after start time.' }
    }
    const clash = dayBookings.find((b) => overlaps(start_time, end_time, b.start_time, b.end_time))
    if (clash) {
      return {
        kind: 'clash',
        text: `Sorry, this time overlaps a booking (${formatTimeLabel(clash.start_time.slice(0, 5))}–${formatTimeLabel(clash.end_time.slice(0, 5))}).`,
      }
    }
    return { kind: 'ok', text: 'This slot is available.' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestForm.start_time, requestForm.end_time, dayBookings])

  const bookingsByDate = useMemo(() => {
    const map = {}
    for (const b of bookings) {
      const minutes = timeToMinutes(b.end_time) - timeToMinutes(b.start_time)
      map[b.booking_date] = (map[b.booking_date] || 0) + minutes
    }
    return map
  }, [bookings])

  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60
  const todayKey = toDateKey(new Date())
  const isSelectedPast = selectedDate && selectedDate < todayKey
  const isSelectedDayFull = selectedDate ? (bookingsByDate[selectedDate] || 0) >= totalMinutes : false
  const isCollapsedDayView = !loading && !isSelectedPast && !requestSuccess && !requestOpen

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
      setRequestError(`This time is already booked (${formatTimeLabel(clash.start_time.slice(0, 5))}–${formatTimeLabel(clash.end_time.slice(0, 5))}), please choose another time`)
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
    <div className="font-sans max-w-md mx-auto">
      {error && (
        <div className="flex items-start gap-2 mb-4 text-sm text-clay bg-clay/10 border border-clay/20 rounded-lg px-3.5 py-3">
          <IconAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p>Could not load bookings. Please try again.</p>
            <p className="text-xs text-clay/70 mt-1">Details: {error}</p>
          </div>
        </div>
      )}

      {/* Opening Hours strip */}
      <div className="bg-pine/5 border-y border-[#E0E0E0] py-1.5 mb-3 -mx-4 px-4">
        <p className="text-center text-xs font-semibold text-[#333333]/70">
          Opening Hours: {DAY_START_HOUR} AM – {DAY_END_HOUR - 12} PM
        </p>
      </div>

      {/* Month calendar card */}
      <div className="bg-white rounded-xl border border-[#E0E0E0]/70 shadow-sm p-3 mb-2">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => {
              setMonthStart(addMonths(monthStart, -1))
              setSelectedDate(null)
            }}
            aria-label="Previous month"
            className="flex items-center justify-center h-7 w-7 rounded-full text-[#333333]/60 hover:bg-mist/40 hover:text-[#333333] transition-colors"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-[#333333] flex items-center gap-1.5">
            <IconCalendar className="h-4 w-4 text-pine" />
            {monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
          <button
            onClick={() => {
              setMonthStart(addMonths(monthStart, 1))
              setSelectedDate(null)
            }}
            aria-label="Next month"
            className="flex items-center justify-center h-7 w-7 rounded-full text-[#333333]/60 hover:bg-mist/40 hover:text-[#333333] transition-colors"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((label) => (
            <p key={label} className="text-center text-[10px] uppercase tracking-wide text-[#333333]/50 font-semibold py-0.5">
              {label}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthCells.map((d, i) => {
            if (!d) return <div key={`blank-${i}`} />
            const key = toDateKey(d)
            const bookedMinutes = bookingsByDate[key] || 0
            const dayStatus = bookedMinutes === 0 ? 'empty' : bookedMinutes >= totalMinutes ? 'full' : 'partial'
            const isSelected = key === selectedDate
            const isPast = key < todayKey
            const isToday = key === todayKey

            const fillClasses = isPast
              ? 'bg-mist/20 text-[#333333]/25 border-transparent'
              : dayStatus === 'full'
              ? 'bg-pine text-white border-pine shadow-sm'
              : dayStatus === 'partial'
              ? 'bg-sage text-[#333333] border-sage shadow-sm'
              : 'bg-mist/30 text-[#333333] border-[#E0E0E0]/70 shadow-sm hover:border-pine/40 hover:shadow-md'

            const ringClasses = isSelected
              ? 'ring-2 ring-ink ring-offset-1'
              : isToday && !isPast
              ? 'ring-2 ring-clay ring-offset-1 font-extrabold'
              : ''

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                disabled={isPast}
                className={`flex items-center justify-center rounded-md py-1.5 border font-sans font-semibold text-xs transition-all ${fillClasses} ${ringClasses}`}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-center gap-2 mt-2.5 pt-2.5 border-t border-[#E0E0E0]/60 text-[10px] text-[#333333]/50">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-mist/30 border border-[#E0E0E0]/70" /> Available
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-sage" /> Partially Booked
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-pine" /> Fully Booked
          </span>
        </div>
      </div>

      {/* Package selector */}
      <p className="inline-block bg-mist/50 rounded-md text-xs uppercase tracking-wide text-[#333333]/80 font-semibold mb-1.5 px-2.5 py-1">Choose a Package</p>
      <div className="grid gap-1.5 mb-2">
        {PACKAGES.map((p) => {
          const isSelected = selectedPackageId === p.id
          const Icon = PACKAGE_ICONS[p.id] || IconMessage
          return (
            <button
              key={p.id}
              onClick={() => setSelectedPackageId(p.id)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 border text-left transition-all ${
                isSelected
                  ? 'bg-pine border-pine text-white shadow-sm'
                  : 'bg-white border-[#E0E0E0] text-[#333333] shadow-sm hover:border-pine/40'
              }`}
            >
              <span
                className={`flex items-center justify-center h-6 w-6 rounded-full shrink-0 ${
                  isSelected ? 'bg-white/15 text-white' : 'bg-pine/10 text-pine'
                }`}
              >
                <Icon className="h-2.5 w-2.5" />
              </span>
              <span className={`flex-1 text-xs font-semibold ${isSelected ? 'text-white' : 'text-[#333333]'}`}>{p.label}</span>
              <span className={`text-[10px] font-medium shrink-0 ${isSelected ? 'text-white/70' : 'text-[#333333]/55'}`}>
                {p.rateLabel || 'WhatsApp'}
              </span>
              {isSelected && <IconCheck className="h-3 w-3 shrink-0" />}
            </button>
          )
        })}
      </div>

      {/* Day detail */}
      {!selectedDate ? (
        <p className="text-sm text-[#333333]/50 py-6 text-center">Select a date</p>
      ) : isCollapsedDayView ? (
        <div className="flex items-center gap-2">
          <div
            className={`flex-1 min-w-0 rounded-lg px-3.5 py-2.5 flex items-center gap-1.5 border ${
              isSelectedDayFull ? 'bg-mist/40 border-[#E0E0E0]' : 'bg-pine border-pine'
            }`}
          >
            <IconCalendar className={`h-3.5 w-3.5 shrink-0 ${isSelectedDayFull ? 'text-[#333333]/40' : 'text-white/80'}`} />
            <span className={`truncate text-sm font-semibold ${isSelectedDayFull ? 'text-[#333333]/50' : 'text-white'}`}>
              {fromDateKey(selectedDate).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </div>
          <button
            onClick={openRequestForm}
            disabled={isSelectedDayFull}
            className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              isSelectedDayFull
                ? 'bg-mist/40 text-[#333333]/35 cursor-not-allowed shadow-none'
                : 'bg-pine text-white shadow-sm hover:opacity-95'
            }`}
          >
            {isSelectedDayFull ? 'Fully Booked' : 'Book this slot'}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E0E0E0]/70 shadow-sm rounded-xl p-2.5">
          <p className="text-sm font-bold text-[#333333] mb-2 flex items-center gap-1.5">
            <IconCalendar className="h-3.5 w-3.5 text-pine" />
            {fromDateKey(selectedDate).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>

          {loading ? (
                <p className="text-sm text-[#333333]/50 py-6 text-center">Loading…</p>
              ) : isSelectedPast ? null : requestSuccess ? (
                <p className="flex items-start gap-2 text-sm text-pine bg-pine/5 border border-pine/20 rounded-lg px-3.5 py-3">
                  <IconCheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {requestSuccess}
                </p>
              ) : (
                <form onSubmit={handleSubmitRequest} className="border border-[#E0E0E0]/70 rounded-xl p-4 bg-[#F9F7F2]/60">
                  <p className="text-base font-bold text-[#333333] mb-3">Booking Request</p>

                  {!selectedPackage ? (
                    <>
                      <p className="text-xs text-[#333333]/60 mb-3">Please select a package above.</p>
                      <button
                        type="button"
                        onClick={() => setRequestOpen(false)}
                        className="w-full border border-[#E0E0E0] rounded-lg py-2.5 text-sm font-medium text-[#333333]/60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <FieldLabel>Time</FieldLabel>
                      {dayBookings.length > 0 && (
                        <p className="text-[11px] text-[#333333]/50 mb-1.5">
                          Booked:{' '}
                          {dayBookings
                            .map((b) => `${formatTimeLabel(b.start_time.slice(0, 5))}–${formatTimeLabel(b.end_time.slice(0, 5))}`)
                            .join(', ')}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 mb-1.5">
                        <select
                          value={requestForm.start_time}
                          onChange={(e) => setRequestForm({ ...requestForm, start_time: e.target.value })}
                          className={inputClass()}
                        >
                          <option value="">From</option>
                          {fromTimeOptions.map((t) => (
                            <option key={t.value} value={t.value} disabled={t.disabled}>{t.label}</option>
                          ))}
                        </select>
                        <select
                          value={requestForm.end_time}
                          onChange={(e) => setRequestForm({ ...requestForm, end_time: e.target.value })}
                          className={inputClass()}
                        >
                          <option value="">To</option>
                          {toTimeOptions.map((t) => (
                            <option key={t.value} value={t.value} disabled={t.disabled}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {availabilityStatus && (
                        <p
                          className={`flex items-center gap-1.5 text-xs font-medium mb-3.5 ${
                            availabilityStatus.kind === 'ok'
                              ? 'text-pine'
                              : availabilityStatus.kind === 'clash'
                              ? 'text-clay'
                              : 'text-[#333333]/50'
                          }`}
                        >
                          {availabilityStatus.kind === 'ok' && <IconCheckCircle className="h-3.5 w-3.5 shrink-0" />}
                          {availabilityStatus.kind === 'clash' && <IconAlert className="h-3.5 w-3.5 shrink-0" />}
                          {availabilityStatus.text}
                        </p>
                      )}

                      {selectedPackageId === 'custom' ? (
                        <div>
                          <p className="text-xs text-[#333333]/60 mb-2.5">
                            Contact us on WhatsApp to discuss packages and pricing for this type of shoot.
                          </p>
                          <a
                            href={buildWhatsAppLink(whatsAppMessage)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 text-center bg-[#25D366] text-white rounded-lg py-3 text-sm font-semibold shadow-sm"
                          >
                            <IconMessage className="h-4 w-4" />
                            Contact on WhatsApp
                          </a>
                        </div>
                      ) : (
                        <>
                          {priceInfo && (
                            <div className="grid grid-cols-2 gap-2 mb-3.5">
                              <div className="rounded-lg bg-pine/5 border border-pine/15 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-[#333333]/50 font-semibold mb-0.5">Total</p>
                                <p className="text-sm font-semibold text-[#333333]">{priceInfo.total} Tk</p>
                              </div>
                              <div className="rounded-lg bg-clay/5 border border-clay/20 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-[#333333]/50 font-semibold mb-0.5">
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
                            <div className="flex items-start gap-2 rounded-lg bg-clay/5 border border-clay/20 px-3.5 py-2.5 mb-3.5">
                              <IconAlert className="h-4 w-4 text-clay shrink-0 mt-0.5" />
                              <p className="text-xs text-clay font-medium">
                                Paying the {ADVANCE_PERCENT}% advance is mandatory to confirm your booking.
                              </p>
                            </div>
                          )}

                          {priceInfo && (
                            <div className="mb-3.5">
                              <FieldLabel>Payment Details</FieldLabel>
                              <div className="flex bg-mist/30 rounded-lg p-1 mb-2">
                                <button
                                  type="button"
                                  onClick={() => setPaymentTab('mobile')}
                                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                                    paymentTab === 'mobile' ? 'bg-white text-pine shadow-sm' : 'text-[#333333]/50'
                                  }`}
                                >
                                  bKash / Nagad
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaymentTab('bank')}
                                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                                    paymentTab === 'bank' ? 'bg-white text-pine shadow-sm' : 'text-[#333333]/50'
                                  }`}
                                >
                                  Bank
                                </button>
                              </div>
                              <div className="rounded-lg bg-white border border-[#E0E0E0]/60 px-3.5 py-2.5 text-xs text-[#333333]/70 space-y-0.5">
                                {paymentTab === 'mobile' ? (
                                  <p>
                                    Send Money to <span className="font-semibold text-[#333333]">{PAYMENT_INFO.mobileBankingNumber}</span> ({PAYMENT_INFO.mobileBankingType})
                                  </p>
                                ) : (
                                  <>
                                    <p className="font-semibold text-[#333333]">{PAYMENT_INFO.bank.accountName}</p>
                                    <p>A/C: {PAYMENT_INFO.bank.accountNumber}</p>
                                    <p>{PAYMENT_INFO.bank.bankName}, {PAYMENT_INFO.bank.branchName} Branch</p>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {requestError && (
                            <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-lg px-3.5 py-2.5 mb-3.5">
                              <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              {requestError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setRequestOpen(false)}
                              className="flex-1 border border-[#E0E0E0] rounded-lg py-2.5 text-sm font-medium text-[#333333]/60"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={requestSaving}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-pine text-white rounded-lg py-2.5 text-sm font-semibold shadow-sm disabled:opacity-50"
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

      <section className="mt-6 pt-4 border-t border-[#E0E0E0]/60">
        <h2 className="text-base font-bold text-[#333333] mb-1">
          Why Choose 4R Studio?
        </h2>
        <p className="text-xs font-bold text-[#333333]/80 leading-snug mb-1">
          4R Studio offers premium studio rental in Aftabnagar, Dhaka. Open 7 days a week, we provide a
          professional space for:
        </p>
        <ul className="text-xs font-bold text-[#333333]/80 leading-snug list-disc list-inside mb-1 space-y-0.5">
          <li>Fashion Photography & Product Photography.</li>
          <li>Videography, Commercial Productions & Content Creation.</li>
          <li>Professional Podcast Recording.</li>
        </ul>
        <p className="text-xs font-bold text-[#333333]/80 leading-snug">
          With premium equipment and a creative environment, 4R Studio helps brands, businesses, and
          creators bring their ideas to life.
        </p>
      </section>

      <p className="text-xs text-[#333333]/50 mt-3 text-center leading-relaxed">
        Your booking request will be confirmed shortly. Your details remain private. For any changes, please{' '}
        <a href={buildWhatsAppLink(whatsAppMessage)} target="_blank" rel="noreferrer" className="underline text-[#333333]/60 hover:text-[#333333]">
          Contact on WhatsApp
        </a>
        .
      </p>
    </div>
  )
}
