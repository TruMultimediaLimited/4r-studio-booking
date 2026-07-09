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
    <div>
      {error && (
        <div className="mb-4 text-sm text-clay bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">
          <p>Could not load bookings. Please try again.</p>
          <p className="text-xs text-clay/70 mt-1">Details: {error}</p>
        </div>
      )}

      <p className="text-sm font-bold text-ink/80 text-center mb-3">
        Opening Hours: {DAY_START_HOUR} AM – {DAY_END_HOUR - 12} PM
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
          ← Previous Month
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
          Next Month →
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

      {/* Package selector */}
      <div className="grid gap-2 mb-4">
        {PACKAGES.map((p) => {
          const isSelected = selectedPackageId === p.id
          return (
            <button
              key={p.id}
              onClick={() => setSelectedPackageId(p.id)}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs border transition-colors ${
                isSelected
                  ? 'bg-pine text-paper border-pine'
                  : 'bg-white text-ink border-mist hover:border-pine/50'
              }`}
            >
              <span>{p.label}</span>
              <span className="font-medium">{p.rateLabel || 'Contact on WhatsApp'}</span>
            </button>
          )
        })}
      </div>

      {/* Day detail */}
      {!selectedDate ? (
        <p className="text-sm text-ink/40 py-6 text-center">Select a date</p>
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
            <p className="text-sm text-ink/40 py-6 text-center">Loading…</p>
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
                  Fully available
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
                      <span className="text-ink/50 text-xs">Booked</span>
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
                  Book this slot
                </button>
              ) : (
                <form onSubmit={handleSubmitRequest} className="border border-mist rounded-xl p-3">
                  <p className="text-sm font-medium mb-2">Booking Request</p>

                  {!selectedPackage ? (
                    <>
                      <p className="text-xs text-ink/60 mb-2">Please select a package above.</p>
                      <button
                        type="button"
                        onClick={() => setRequestOpen(false)}
                        className="w-full border border-mist rounded-lg py-2 text-sm font-medium text-ink/60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <select
                          value={requestForm.start_time}
                          onChange={(e) => setRequestForm({ ...requestForm, start_time: e.target.value })}
                          className="border border-mist rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">Start time</option>
                          {TIME_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <select
                          value={requestForm.end_time}
                          onChange={(e) => setRequestForm({ ...requestForm, end_time: e.target.value })}
                          className="border border-mist rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">End time</option>
                          {TIME_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {selectedPackageId === 'custom' ? (
                        <div>
                          <p className="text-xs text-ink/60 mb-2">
                            Contact us on WhatsApp to discuss packages and pricing for this type of shoot.
                          </p>
                          <a
                            href={buildWhatsAppLink(whatsAppMessage)}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-center bg-[#25D366] text-white rounded-lg py-2 text-sm font-medium"
                          >
                            Contact on WhatsApp
                          </a>
                        </div>
                      ) : (
                        <>
                          {priceInfo && (
                            <div className="text-xs bg-pine/5 border border-pine/20 rounded-lg px-3 py-2 mb-2">
                              Total: {priceInfo.total} Tk
                            </div>
                          )}
                          {priceInfo && (
                            <div className="text-xs bg-pine/5 border border-pine/20 rounded-lg px-3 py-2 mb-2">
                              Advance ({ADVANCE_PERCENT}%): {priceInfo.advance} Tk
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <input
                              type="text"
                              placeholder="Your name"
                              value={requestForm.client_name}
                              onChange={(e) => setRequestForm({ ...requestForm, client_name: e.target.value })}
                              className="col-span-2 border border-mist rounded-lg px-3 py-2 text-sm"
                            />
                            <input
                              type="tel"
                              placeholder="Phone number"
                              value={requestForm.client_phone}
                              onChange={(e) => setRequestForm({ ...requestForm, client_phone: e.target.value })}
                              className="col-span-2 border border-mist rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          {priceInfo && (
                            <p className="text-xs text-clay font-medium mb-2">
                              ⚠ Paying the {ADVANCE_PERCENT}% advance is mandatory to confirm your booking.
                            </p>
                          )}
                          {priceInfo && (
                            <div className="border border-mist rounded-lg overflow-hidden mb-2">
                              <div className="flex">
                                <button
                                  type="button"
                                  onClick={() => setPaymentTab('mobile')}
                                  className={`flex-1 text-xs py-1.5 font-medium ${
                                    paymentTab === 'mobile' ? 'bg-pine text-paper' : 'bg-mist/20 text-ink/60'
                                  }`}
                                >
                                  bKash / Nagad
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaymentTab('bank')}
                                  className={`flex-1 text-xs py-1.5 font-medium ${
                                    paymentTab === 'bank' ? 'bg-pine text-paper' : 'bg-mist/20 text-ink/60'
                                  }`}
                                >
                                  Bank
                                </button>
                              </div>
                              <div className="px-3 py-2 text-xs bg-mist/10">
                                {paymentTab === 'mobile' ? (
                                  <p>
                                    Send Money to {PAYMENT_INFO.mobileBankingNumber} ({PAYMENT_INFO.mobileBankingType})
                                  </p>
                                ) : (
                                  <>
                                    <p>{PAYMENT_INFO.bank.accountName}</p>
                                    <p>A/C: {PAYMENT_INFO.bank.accountNumber}</p>
                                    <p>{PAYMENT_INFO.bank.bankName}, {PAYMENT_INFO.bank.branchName} Branch</p>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
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
                              Cancel
                            </button>
                            <button
                              disabled={requestSaving}
                              className="flex-1 bg-pine text-paper rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                            >
                              {requestSaving ? 'Sending…' : 'Send Request'}
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

      <p className="text-xs text-ink/40 mt-4 text-center">
        We'll contact you to confirm your booking after you send a request. Client names aren't shown publicly on this page.
        Message us on WhatsApp if you need to change the date/time:{' '}
        <a href={buildWhatsAppLink(whatsAppMessage)} target="_blank" rel="noreferrer" className="underline">
          Contact on WhatsApp
        </a>
        .
      </p>
    </div>
  )
}
