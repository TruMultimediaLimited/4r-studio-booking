import { useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { isValidBangladeshiPhone } from '../lib/validation.js'
import { fromDateKey, formatTimeLabel } from '../lib/time.js'
import { IconX, IconSearch, IconAlert, IconCalendar, IconInbox } from './icons.jsx'

const STATUS_META = {
  pending: { label: 'Pending', className: 'bg-clay/10 text-clay border-clay/30' },
  confirmed: { label: 'Confirmed', className: 'bg-pine/10 text-pine border-pine/30' },
  cancelled: { label: 'Cancelled', className: 'bg-mist/50 text-ink/40 border-mist' },
}

export default function MyBookingsModal({ onClose }) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)

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
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-ink/40 px-4 py-8 overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-sm bg-paper rounded-2xl shadow-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-display text-xl text-ink">My Bookings</p>
          <button onClick={onClose} aria-label="Close" className="text-ink/40 hover:text-ink">
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-ink/50 mb-4">Enter the phone number you used when booking to see your request status.</p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 01712345678"
            className="flex-1 border border-mist rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15"
          />
          <button
            disabled={loading}
            aria-label="Search"
            className="flex items-center justify-center bg-pine text-paper rounded-xl px-4 disabled:opacity-50"
          >
            <IconSearch className="h-4 w-4" />
          </button>
        </form>

        {error && (
          <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3.5 py-2.5 mb-4">
            <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
          </p>
        )}

        {loading && <p className="text-sm text-ink/40 py-6 text-center">Searching…</p>}

        {results && !loading && (
          results.length === 0 ? (
            <p className="flex flex-col items-center gap-2 text-sm text-ink/40 py-8 text-center">
              <IconInbox className="h-6 w-6" /> No bookings found for this number.
            </p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {results.map((b) => {
                const meta = STATUS_META[b.status] || STATUS_META.confirmed
                return (
                  <li key={b.id} className="bg-white border border-mist/70 rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-sm font-medium flex items-center gap-1.5 min-w-0">
                        <IconCalendar className="h-3.5 w-3.5 text-pine shrink-0" />
                        <span className="truncate">
                          {fromDateKey(b.booking_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </span>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 shrink-0 ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-ink/60">
                      {formatTimeLabel(b.start_time.slice(0, 5))} – {formatTimeLabel(b.end_time.slice(0, 5))}
                    </p>
                    {b.package_name && <p className="text-xs text-ink/45 mt-0.5 truncate">{b.package_name}</p>}
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
