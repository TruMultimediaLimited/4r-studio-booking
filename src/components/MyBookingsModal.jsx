import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { isValidBangladeshiPhone } from '../lib/validation.js'
import { fromDateKey, formatTimeLabel } from '../lib/time.js'
import { IconX, IconSearch, IconAlert, IconCalendar, IconInbox } from './icons.jsx'

const STATUS_META = {
  pending: { label: 'Pending', className: 'bg-clay/10 text-clay border-clay/30' },
  confirmed: { label: 'Confirmed', className: 'bg-pine/10 text-pine border-pine/30' },
  cancelled: { label: 'Cancelled', className: 'bg-mist/50 text-[#333333]/55 border-[#E0E0E0]' },
}

export default function MyBookingsModal({ onClose }) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    if (!isValidBangladeshiPhone(phone)) {
      setError('Please enter a valid Bangladeshi phone number (e.g. 01712345678)')
      return
    }
    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc('get_bookings_by_phone', { p_phone: phone })
    setLoading(false)
    if (rpcError) {
      setError('Could not load bookings: ' + rpcError.message)
      return
    }
    setResults(data || [])
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="My Bookings"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-ink/40 px-4 py-8 overflow-y-auto"
      onClick={onClose}
    >
      <div className="font-sans w-full max-w-sm bg-[#F9F7F2] rounded-xl shadow-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xl font-bold text-[#333333]">My Bookings</p>
          <button onClick={onClose} aria-label="Close" className="text-[#333333]/55 hover:text-[#333333]">
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-[#333333]/55 mb-4">Enter the phone number you used when booking — you'll be able to see the status of your request.</p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 01712345678"
            aria-label="Phone number"
            autoComplete="tel"
            inputMode="tel"
            maxLength={20}
            className="flex-1 border border-[#E0E0E0] rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15"
          />
          <button
            disabled={loading}
            aria-label="Search"
            className="flex items-center justify-center bg-pine text-white rounded-lg px-4 disabled:opacity-50"
          >
            <IconSearch className="h-4 w-4" />
          </button>
        </form>

        {error && (
          <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-lg px-3.5 py-2.5 mb-4">
            <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
          </p>
        )}

        {loading && <p className="text-sm text-[#333333]/55 py-6 text-center">Searching…</p>}

        {results && !loading && (
          results.length === 0 ? (
            <p className="flex flex-col items-center gap-2 text-sm text-[#333333]/60 py-8 text-center">
              <IconInbox className="h-6 w-6" /> No bookings found for this number.
            </p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {results.map((b) => {
                const meta = STATUS_META[b.status] || STATUS_META.confirmed
                return (
                  <li key={b.id} className="bg-white border border-[#E0E0E0]/70 rounded-lg px-3.5 py-2.5">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-sm font-medium flex items-center gap-1.5 min-w-0">
                        <IconCalendar className="h-3.5 w-3.5 text-pine shrink-0" />
                        <span className="truncate">
                          {fromDateKey(b.booking_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </span>
                      <span className={`text-[11px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 shrink-0 ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#333333]/60">
                      {formatTimeLabel(b.start_time.slice(0, 5))} – {formatTimeLabel(b.end_time.slice(0, 5))}
                    </p>
                    {b.package_name && <p className="text-xs text-[#333333]/55 mt-0.5 truncate">{b.package_name}</p>}
                  </li>
                )
              })}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
