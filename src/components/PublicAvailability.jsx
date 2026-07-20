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
import { DEFAULT_PACKAGES, ADVANCE_PERCENT, PAYMENT_INFO, buildWhatsAppLink } from '../lib/packages.js'
import { isValidBangladeshiPhone, isValidClientName } from '../lib/validation.js'
import { IconTag } from './icons.jsx'

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
  const [expandedInclusionId, setExpandedInclusionId] = useState('')
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestForm, setRequestForm] = useState(emptyRequestForm)
  const [requestError, setRequestError] = useState('')
  const [requestSuccess, setRequestSuccess] = useState('')
  const [lastRequest, setLastRequest] = useState(null)
  const [requestSaving, setRequestSaving] = useState(false)
  const [paymentTab, setPaymentTab] = useState('mobile')

  const [packages, setPackages] = useState(DEFAULT_PACKAGES)
  const [businessHours, setBusinessHours] = useState({ start: BUSINESS_START_HOUR, end: BUSINESS_END_HOUR })
  const [offDays, setOffDays] = useState([])

  useEffect(() => {
    async function loadConfig() {
      // Failures here fall back to the hardcoded defaults; log so they're
      // at least diagnosable from the browser console.
      const [packagesRes, settingsRes, offDaysRes] = await Promise.all([
        supabase.from('packages').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('studio_settings').select('*').single(),
        supabase.from('off_days').select('off_date'),
      ])
      if (packagesRes.error) console.error('Failed to load packages:', packagesRes.error)
      if (settingsRes.error) console.error('Failed to load settings:', settingsRes.error)
      if (offDaysRes.error) console.error('Failed to load off-days:', offDaysRes.error)
      if (packagesRes.data && packagesRes.data.length > 0) {
        setPackages(
          packagesRes.data.map((p) => ({
            id: p.id,
            label: p.label,
            rateLabel: p.rate_label,
            hourlyRate: p.hourly_rate,
            inclusions: p.inclusions,
          }))
        )
      }
      if (settingsRes.data) {
        setBusinessHours({ start: settingsRes.data.business_start_hour, end: settingsRes.data.business_end_hour })
      }
      if (offDaysRes.data) {
        setOffDays(offDaysRes.data.map((d) => d.off_date))
      }
    }
    loadConfig()
  }, [])

  const DAY_START_HOUR = businessHours.start
  const DAY_END_HOUR = businessHours.end
  const TIME_OPTIONS = useMemo(() => generateTimeOptions(DAY_START_HOUR, DAY_END_HOUR), [DAY_START_HOUR, DAY_END_HOUR])
  // A booking can't start at closing time (no room left to end), so the
  // "From" list drops the final (closing-time) option; "To" keeps it.
  const FROM_TIME_OPTIONS = useMemo(() => TIME_OPTIONS.slice(0, -1), [TIME_OPTIONS])

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
      console.error('Failed to load bookings:', error)
      setError(true)
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

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const isSelectedToday = selectedDate === toDateKey(now)

  function markBookedStatus(options) {
    return options.map((opt) => {
      const t = timeToMinutes(opt.value)
      const isBooked = dayBookings.some((b) => t >= timeToMinutes(b.start_time) && t < timeToMinutes(b.end_time))
      const isPassed = isSelectedToday && t <= nowMinutes
      return {
        ...opt,
        disabled: isBooked || isPassed,
        label: isBooked ? `${opt.label} (Booked)` : isPassed ? `${opt.label} (Passed)` : opt.label,
      }
    })
  }

  // "From" excludes the last option (closing time) — a booking can't start
  // exactly when the studio closes, since there'd be no room left to end.
  const fromTimeOptions = useMemo(
    () => markBookedStatus(FROM_TIME_OPTIONS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayBookings, selectedDate]
  )
  const toTimeOptions = useMemo(
    () => markBookedStatus(TIME_OPTIONS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayBookings, selectedDate]
  )

  const availabilityStatus = useMemo(() => {
    const { start_time, end_time } = requestForm
    if (!start_time || !end_time) return null
    if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
      return { kind: 'warn', text: 'End time must be after the start time.' }
    }
    if (isSelectedToday && timeToMinutes(start_time) <= nowMinutes) {
      return { kind: 'warn', text: 'This time today has already passed.' }
    }
    const clash = dayBookings.find((b) => overlaps(start_time, end_time, b.start_time, b.end_time))
    if (clash) {
      return {
        kind: 'clash',
        text: `Sorry, there's already a booking at this time (${formatTimeLabel(clash.start_time.slice(0, 5))}–${formatTimeLabel(clash.end_time.slice(0, 5))}).`,
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
  const isSelectedOffDay = selectedDate ? offDays.includes(selectedDate) : false
  const isCollapsedDayView = !loading && !isSelectedPast && !requestSuccess && !requestOpen

  const selectedPackage = packages.find((p) => p.id === selectedPackageId) || null

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
      setRequestError('Please enter your name, phone number, and time')
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
      setRequestError('Start time must be before the end time')
      return
    }
    if (isSelectedToday && timeToMinutes(start_time) <= nowMinutes) {
      setRequestError('This time today has already passed, please choose a later time')
      return
    }
    const clash = dayBookings.find((b) => overlaps(start_time, end_time, b.start_time, b.end_time))
    if (clash) {
      setRequestError(`There's already a booking at this time (${formatTimeLabel(clash.start_time.slice(0, 5))}–${formatTimeLabel(clash.end_time.slice(0, 5))}), please choose another time`)
      return
    }

    const packageName = priceInfo
      ? `${selectedPackage.label} (${selectedPackage.rateLabel}) — ${priceInfo.hours} hr = ${priceInfo.total} Tk, advance ${priceInfo.advance} Tk`
      : selectedPackage.label

    setRequestSaving(true)
    // total_amount is deliberately NOT sent — the database computes the
    // price server-side from the package's hourly rate (see
    // validate_public_booking in docs/schema.sql), so a tampered client
    // can't set its own price.
    const { error } = await supabase.from('bookings').insert({
      booking_date: selectedDate,
      start_time,
      end_time,
      client_name,
      client_phone,
      package_name: packageName,
      package_id: selectedPackage.id,
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
    setLastRequest({
      dateKey: selectedDate,
      start: start_time,
      end: end_time,
      packageLabel: selectedPackage.label,
      total: priceInfo ? priceInfo.total : null,
      advance: priceInfo ? priceInfo.advance : null,
    })
    setRequestSuccess('Your request has been sent. We will contact you shortly to confirm the booking.')
    loadBookings()
  }

  return (
    <div className="font-sans max-w-md lg:max-w-4xl mx-auto">
      {error && (
        <div className="flex items-start gap-2 mb-4 text-sm text-clay bg-clay/10 border border-clay/20 rounded-lg px-3.5 py-3">
          <IconAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="flex-1">Could not load bookings. Please check your internet connection and try again.</p>
          <button onClick={loadBookings} className="text-xs font-semibold underline shrink-0 hover:opacity-80">
            Try again
          </button>
        </div>
      )}

      {/* Opening Hours strip */}
      <div className="bg-pine/5 border-y border-[#E0E0E0] py-1.5 mb-1.5 -mx-4 px-4">
        <p className="text-center text-xs font-semibold text-[#333333]/70">
          Opening hours: {formatTimeLabel(`${String(DAY_START_HOUR).padStart(2, '0')}:00`)} – {formatTimeLabel(`${String(DAY_END_HOUR).padStart(2, '0')}:00`)}
        </p>
      </div>

      <div>
      <div className="min-w-0">
      {/* Month calendar card */}
      <div className="bg-white rounded-xl border border-[#E0E0E0]/70 shadow-sm p-3 mb-2">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => {
              setMonthStart(addMonths(monthStart, -1))
              setSelectedDate(null)
            }}
            disabled={monthStart <= startOfMonth(new Date())}
            aria-label="Previous month"
            className="flex items-center justify-center h-7 w-7 rounded-full text-[#333333]/60 hover:bg-mist/40 hover:text-[#333333] transition-colors disabled:opacity-30 disabled:pointer-events-none"
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
            <p key={label} className="text-center text-[11px] uppercase tracking-wide text-[#333333]/60 font-semibold py-0.5">
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
            const isOffDay = offDays.includes(key)

            const fillClasses = isPast
              ? 'bg-mist/20 text-[#333333]/25 border-transparent'
              : isOffDay
              ? 'bg-clay/10 text-clay/70 border-clay/20'
              : dayStatus === 'full'
              ? 'bg-pine text-white border-pine shadow-sm'
              : dayStatus === 'partial'
              ? 'bg-sage text-[#333333] border-sage shadow-sm'
              : 'bg-mist/30 text-[#333333] border-[#E0E0E0]/70 shadow-sm hover:border-pine/40 hover:shadow-md'

            const ringClasses = isSelected ? 'ring-2 ring-ink ring-offset-1' : ''

            const statusText = isOffDay
              ? 'Studio closed'
              : dayStatus === 'full'
              ? 'Fully booked'
              : dayStatus === 'partial'
              ? 'Partially booked'
              : 'Available'

            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedDate(key)
                  setRequestSuccess('')
                  setLastRequest(null)
                }}
                disabled={isPast}
                aria-label={`${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, ${statusText}`}
                aria-pressed={isSelected}
                className={`flex items-center justify-center rounded-md py-2 border font-sans font-semibold text-xs transition-all ${fillClasses} ${ringClasses}`}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-center gap-2 mt-2.5 pt-2.5 border-t border-[#E0E0E0]/60 text-[11px] text-[#333333]/60">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-mist/30 border border-[#E0E0E0]/70" /> Available
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-sage" /> Partially booked
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-pine" /> Fully booked
          </span>
        </div>
      </div>

      <p className="inline-flex items-center gap-1.5 bg-pine/85 text-white text-xs font-semibold rounded-full px-3 py-1.5 mb-2">
        <IconTag className="h-3 w-3" /> Choose a Package
      </p>
      <div className="grid gap-1.5 mb-2">
        {packages.map((p) => {
          const isSelected = selectedPackageId === p.id
          const inclusions = p.inclusions
            ? p.inclusions.split('\n').map((s) => s.trim()).filter(Boolean)
            : []
          const isExpanded = expandedInclusionId === p.id
          return (
            <div
              key={p.id}
              className={`rounded-lg border transition-all ${
                isSelected ? 'bg-pine/5 border-pine shadow-sm' : 'bg-white border-[#E0E0E0] shadow-sm hover:border-pine/40'
              }`}
            >
              <button
                onClick={() => {
                  setSelectedPackageId(p.id)
                  setExpandedInclusionId((prev) => (prev === p.id ? '' : (inclusions.length > 0 ? p.id : '')))
                }}
                className="flex flex-col gap-0.5 w-full px-2.5 py-1.5 text-left"
              >
                <span className={`text-xs font-semibold ${isSelected ? 'text-pine' : 'text-[#333333]'}`}>{p.label}</span>
                <span className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-medium ${isSelected ? 'text-pine/70' : 'text-[#333333]/55'}`}>
                    {p.rateLabel || 'WhatsApp'}
                  </span>
                  {inclusions.length > 0 && (
                    <IconChevronRight
                      className={`h-3 w-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''} ${
                        isSelected ? 'text-pine/70' : 'text-[#333333]/45'
                      }`}
                    />
                  )}
                </span>
              </button>
              {inclusions.length > 0 && (
                <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                    <div className={`mx-2.5 mb-2 rounded-md p-3.5 ${isSelected ? 'bg-white' : 'bg-pine/5'}`}>
                      <ul className="flex flex-col gap-3 text-[#333333]/70">
                        {inclusions.map((item, i) => {
                          const colonIdx = item.indexOf(':')
                          const hasLabel = colonIdx > 0 && colonIdx < 30
                          const label = hasLabel ? item.slice(0, colonIdx) : null
                          const rest = hasLabel ? item.slice(colonIdx + 1).trim() : item
                          return (
                            <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed">
                              <IconCheck className="h-3 w-3 shrink-0 mt-1 text-pine/70" />
                              <span>
                                {label && <span className="font-semibold text-pine">{label}: </span>}
                                {rest}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      </div>

      <div className="min-w-0">
      {/* Day detail */}
      {!selectedDate ? (
        <p className="text-sm text-[#333333]/55 py-6 text-center">Select a date</p>
      ) : isCollapsedDayView ? (
        <div className="grid grid-cols-2 gap-2">
          <a
            href="#/portfolio"
            className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold text-center bg-pine/85 text-white shadow-sm hover:opacity-95 transition-opacity"
          >
            <IconCamera className="h-4 w-4" /> Portfolio
          </a>
          <button
            onClick={openRequestForm}
            disabled={isSelectedDayFull || isSelectedOffDay}
            className={`rounded-lg py-2.5 text-sm font-semibold text-center transition-all ${
              isSelectedDayFull || isSelectedOffDay
                ? 'bg-mist/40 text-[#333333]/35 cursor-not-allowed shadow-none'
                : 'bg-pine/85 text-white shadow-sm hover:opacity-95'
            }`}
          >
            {isSelectedOffDay ? 'Studio closed' : isSelectedDayFull ? 'Fully booked' : 'Book this slot'}
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
                <p className="text-sm text-[#333333]/55 py-6 text-center">Loading…</p>
              ) : isSelectedPast ? null : requestSuccess ? (
                <div>
                  <p className="flex items-start gap-2 text-sm text-pine bg-pine/5 border border-pine/20 rounded-lg px-3.5 py-3 mb-2.5">
                    <IconCheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {requestSuccess}
                  </p>
                  {lastRequest && (
                    <div className="rounded-lg bg-white border border-[#E0E0E0]/70 px-3.5 py-2.5 text-xs text-[#333333]/75 space-y-1 mb-2.5">
                      <p className="text-[11px] tracking-wide font-semibold text-[#333333]/60">Your Request</p>
                      <p>
                        <span className="font-semibold text-[#333333]">
                          {fromDateKey(lastRequest.dateKey).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                        , {formatTimeLabel(lastRequest.start)} – {formatTimeLabel(lastRequest.end)}
                      </p>
                      <p>{lastRequest.packageLabel}</p>
                      {lastRequest.total != null && (
                        <p>
                          Total <span className="font-semibold text-[#333333]">{lastRequest.total} Tk</span> · Advance ({ADVANCE_PERCENT}%){' '}
                          <span className="font-semibold text-clay">{lastRequest.advance} Tk</span>
                        </p>
                      )}
                    </div>
                  )}
                  {lastRequest && lastRequest.advance != null && (
                    <div className="rounded-lg bg-clay/5 border border-clay/20 px-3.5 py-2.5 text-xs text-[#333333]/75 space-y-1 mb-2.5">
                      <p className="text-[11px] font-semibold text-clay">
                        Please pay a {lastRequest.advance} Tk advance to confirm your desired booking slot.
                      </p>
                      <p>
                        bKash / Nagad (Send Money): <span className="font-semibold text-[#333333]">{PAYMENT_INFO.mobileBankingNumber}</span> ({PAYMENT_INFO.mobileBankingType})
                      </p>
                      <p>
                        Bank: {PAYMENT_INFO.bank.accountName}, A/C {PAYMENT_INFO.bank.accountNumber}, {PAYMENT_INFO.bank.bankName}, {PAYMENT_INFO.bank.branchName} Branch
                      </p>
                    </div>
                  )}
                  <a
                    href={buildWhatsAppLink(
                      lastRequest
                        ? `Hello, I just sent a booking request at 4R Studio. Date: ${fromDateKey(lastRequest.dateKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, Time: ${formatTimeLabel(lastRequest.start)} – ${formatTimeLabel(lastRequest.end)}, Package: ${lastRequest.packageLabel}.${lastRequest.advance != null ? ` I am sending the ${lastRequest.advance} Tk advance payment screenshot.` : ''}`
                        : whatsAppMessage
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 text-center bg-[#25D366] text-white rounded-lg py-2.5 text-sm font-semibold shadow-sm"
                  >
                    <IconMessage className="h-4 w-4" />
                    After completing payment, please share a screenshot of the transaction for our tracking.
                  </a>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="border border-[#E0E0E0]/70 rounded-xl p-4 bg-[#F9F7F2]/60">
                  <p className="text-base font-bold text-[#333333] mb-3">Booking Request</p>

                  {!selectedPackage ? (
                    <>
                      <p className="text-xs text-[#333333]/60 mb-3">Please choose a package from above.</p>
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
                        <p className="text-[11px] text-[#333333]/55 mb-1.5">
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
                          aria-label="Start time"
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
                          aria-label="End time"
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
                              : 'text-[#333333]/60'
                          }`}
                        >
                          {availabilityStatus.kind === 'ok' && <IconCheckCircle className="h-3.5 w-3.5 shrink-0" />}
                          {availabilityStatus.kind === 'clash' && <IconAlert className="h-3.5 w-3.5 shrink-0" />}
                          {availabilityStatus.text}
                        </p>
                      )}

                      {!selectedPackage.hourlyRate ? (
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
                            Contact us on WhatsApp
                          </a>
                        </div>
                      ) : (
                        <>
                          {priceInfo && (
                            <div className="grid grid-cols-2 gap-2 mb-3.5">
                              <div className="rounded-lg bg-pine/5 border border-pine/15 px-3 py-2.5">
                                <p className="text-[11px] tracking-wide text-[#333333]/60 font-semibold mb-0.5">Total</p>
                                <p className="text-sm font-semibold text-[#333333]">{priceInfo.total} Tk</p>
                              </div>
                              <div className="rounded-lg bg-clay/5 border border-clay/20 px-3 py-2.5">
                                <p className="text-[11px] tracking-wide text-[#333333]/60 font-semibold mb-0.5">
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
                              aria-label="Your name"
                              autoComplete="name"
                              maxLength={100}
                              value={requestForm.client_name}
                              onChange={(e) => setRequestForm({ ...requestForm, client_name: e.target.value })}
                              className={inputClass()}
                            />
                            <input
                              type="tel"
                              placeholder="Phone number (01XXXXXXXXX)"
                              aria-label="Phone number"
                              autoComplete="tel"
                              inputMode="tel"
                              maxLength={20}
                              value={requestForm.client_phone}
                              onChange={(e) => setRequestForm({ ...requestForm, client_phone: e.target.value })}
                              className={inputClass()}
                            />
                          </div>

                          {priceInfo && (
                            <div className="flex items-start gap-2 rounded-lg bg-clay/5 border border-clay/20 px-3.5 py-2.5 mb-3.5">
                              <IconAlert className="h-4 w-4 text-clay shrink-0 mt-0.5" />
                              <p className="text-xs text-clay font-medium">
                                A {ADVANCE_PERCENT}% advance payment is required to confirm your booking.
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
                                    paymentTab === 'mobile' ? 'bg-white text-pine shadow-sm' : 'text-[#333333]/60'
                                  }`}
                                >
                                  bKash / Nagad
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaymentTab('bank')}
                                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                                    paymentTab === 'bank' ? 'bg-white text-pine shadow-sm' : 'text-[#333333]/60'
                                  }`}
                                >
                                  Bank
                                </button>
                              </div>
                              <div className="rounded-lg bg-white border border-[#E0E0E0]/60 px-3.5 py-2.5 text-xs text-[#333333]/70 space-y-0.5">
                                {paymentTab === 'mobile' ? (
                                  <p>
                                    Send Money to this number: <span className="font-semibold text-[#333333]">{PAYMENT_INFO.mobileBankingNumber}</span> ({PAYMENT_INFO.mobileBankingType})
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
      </div>
      </div>

      <p className="text-xs text-[#333333]/55 mt-3 text-center leading-relaxed">
        After sending a request, we'll get in touch quickly to confirm. Your information stays private. If you need to make any changes,{' '}
        <a href={buildWhatsAppLink(whatsAppMessage)} target="_blank" rel="noreferrer" className="underline text-[#333333]/65 hover:text-[#333333]">
          message us on WhatsApp
        </a>{' '}
        or call{' '}
        <a href="tel:+8801335254627" className="underline text-[#333333]/65 hover:text-[#333333] whitespace-nowrap">
          +880 1335-254627
        </a>
        .
      </p>
    </div>
  )
}
