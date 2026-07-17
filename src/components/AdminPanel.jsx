import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { timeToMinutes, overlaps, toDateKey, fromDateKey, formatTimeLabel, generateTimeOptions } from '../lib/time.js'
import { isValidBangladeshiPhone, isValidClientName } from '../lib/validation.js'
import {
  IconCalendar,
  IconAlert,
  IconEdit,
  IconSearch,
  IconX,
  IconPhone,
  IconLogOut,
  IconChevronDown,
  IconPlus,
  IconUser,
  IconTag,
  IconInbox,
  IconTrash,
} from './icons.jsx'

const TIME_OPTIONS = generateTimeOptions()

const STATUS_META = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelled: { label: 'Cancelled', className: 'bg-mist/50 text-ink/40 border-mist' },
}

const emptyForm = { booking_date: '', start_time: '', end_time: '', client_name: '', client_phone: '', package_name: '' }

function inputClass() {
  return 'w-full border border-mist rounded-xl px-3 py-2 text-xs outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15'
}

function formatBookingDate(dateKey) {
  return fromDateKey(dateKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.confirmed
  return (
    <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wide border rounded-full px-1.5 py-0.5 shrink-0 ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function BookingEditForm({ editForm, onChange, editError, editSaving, onSave, onCancel }) {
  return (
    <div className="space-y-2.5">
      <input
        type="date"
        value={editForm.booking_date}
        onChange={(e) => onChange({ ...editForm, booking_date: e.target.value })}
        className={inputClass()}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <select value={editForm.start_time} onChange={(e) => onChange({ ...editForm, start_time: e.target.value })} className={inputClass()}>
          <option value="">Start Time</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select value={editForm.end_time} onChange={(e) => onChange({ ...editForm, end_time: e.target.value })} className={inputClass()}>
          <option value="">End Time</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <input
        type="text"
        placeholder="Client Name"
        value={editForm.client_name}
        onChange={(e) => onChange({ ...editForm, client_name: e.target.value })}
        className={inputClass()}
      />
      <input
        type="tel"
        placeholder="Phone Number"
        value={editForm.client_phone}
        onChange={(e) => onChange({ ...editForm, client_phone: e.target.value })}
        className={inputClass()}
      />
      <input
        type="text"
        placeholder="Package"
        value={editForm.package_name}
        onChange={(e) => onChange({ ...editForm, package_name: e.target.value })}
        className={inputClass()}
      />
      {editError && (
        <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3.5 py-2.5">
          <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {editError}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 border border-mist rounded-lg py-1.5 text-xs font-medium text-ink/60">
          Cancel
        </button>
        <button
          type="button"
          disabled={editSaving}
          onClick={onSave}
          className="flex-1 bg-pine text-paper rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {editSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function BookingRow({
  b,
  isExpanded,
  onToggle,
  isEditing,
  editForm,
  onEditFormChange,
  editError,
  editSaving,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onConfirm,
  onReject,
  onCancel,
  onDelete,
}) {
  return (
    <li className={`bg-white border rounded-xl overflow-hidden text-xs shadow-sm ${b.status === 'pending' ? 'border-amber-300' : 'border-mist/70'}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left">
        <span className="flex items-center gap-2 min-w-0">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-pine/10 text-pine shrink-0">
            <IconUser className="h-3 w-3" />
          </span>
          <span className="min-w-0">
            <span className="text-xs font-semibold truncate block">{b.client_name || 'No name'}</span>
            <span className="text-[10px] text-ink/45">
              {formatBookingDate(b.booking_date)} · {formatTimeLabel(b.start_time.slice(0, 5))}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={b.status} />
          <IconChevronDown className={`h-3.5 w-3.5 text-ink/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isExpanded && (
        <div className="px-2.5 pb-2.5 pt-0.5 border-t border-mist/60">
          {isEditing ? (
            <BookingEditForm
              editForm={editForm}
              onChange={onEditFormChange}
              editError={editError}
              editSaving={editSaving}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          ) : (
            <>
              <div className="space-y-1 text-[10px] text-ink/70 mb-2 mt-1.5">
                <p className="flex items-center gap-1.5">
                  <IconCalendar className="h-3 w-3 text-ink/40 shrink-0" />
                  {formatBookingDate(b.booking_date)}, {formatTimeLabel(b.start_time.slice(0, 5))} – {formatTimeLabel(b.end_time.slice(0, 5))}
                </p>
                <p className="flex items-center gap-1.5">
                  <IconPhone className="h-3 w-3 text-ink/40 shrink-0" />
                  {b.client_phone || 'Not provided'}
                </p>
                <p className="flex items-center gap-1.5">
                  <IconTag className="h-3 w-3 text-ink/40 shrink-0" />
                  {b.package_name || 'Not specified'}
                </p>
              </div>
              <div className="flex gap-1.5">
                {b.status === 'pending' && (
                  <>
                    <button onClick={onReject} className="flex-1 border border-mist rounded-lg py-1 text-[10px] font-medium text-ink/60">
                      Reject
                    </button>
                    <button onClick={onConfirm} className="flex-1 bg-pine text-paper rounded-lg py-1 text-[10px] font-medium">
                      Confirm
                    </button>
                  </>
                )}
                {b.status === 'confirmed' && (
                  <button onClick={onCancel} className="flex-1 border border-clay/30 text-clay rounded-lg py-1 text-[10px] font-medium">
                    Cancel Booking
                  </button>
                )}
                {b.status !== 'cancelled' && (
                  <button
                    onClick={onStartEdit}
                    className="flex items-center justify-center gap-1 flex-1 border border-mist rounded-lg py-1 text-[10px] font-medium text-ink/70"
                  >
                    <IconEdit className="h-3 w-3" /> Edit
                  </button>
                )}
                {b.status === 'cancelled' && (
                  <button
                    onClick={onDelete}
                    className="flex items-center justify-center gap-1 flex-1 border border-clay/30 text-clay rounded-lg py-1 text-[10px] font-medium"
                  >
                    <IconTrash className="h-3 w-3" /> Delete Permanently
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}

export default function AdminPanel() {
  const [session, setSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState(null) // null | 'today' | 'month'

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (editingId === id) cancelEdit()
      } else {
        next.add(id)
      }
      return next
    })
  }

  function startEdit(b) {
    setEditingId(b.id)
    setEditError('')
    setEditForm({
      booking_date: b.booking_date,
      start_time: b.start_time.slice(0, 5),
      end_time: b.end_time.slice(0, 5),
      client_name: b.client_name || '',
      client_phone: b.client_phone || '',
      package_name: b.package_name || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
    setEditError('')
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthChecked(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    setLoggingIn(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoggingIn(false)
    if (error) {
      setLoginError('Incorrect email or password')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  useEffect(() => {
    if (!session) return
    loadBookings()
  }, [session])

  async function loadBookings() {
    setLoadingBookings(true)
    const { data } = await supabase.from('bookings').select('*').order('booking_date').order('start_time')
    setBookings(data || [])
    setLoadingBookings(false)
  }

  const todayKey = toDateKey(new Date())
  const monthPrefix = todayKey.slice(0, 7)

  const stats = useMemo(
    () => ({
      pending: bookings.filter((b) => b.status === 'pending').length,
      today: bookings.filter((b) => b.status !== 'cancelled' && b.booking_date === todayKey).length,
      month: bookings.filter((b) => b.status !== 'cancelled' && b.booking_date.startsWith(monthPrefix)).length,
    }),
    [bookings, todayKey, monthPrefix]
  )

  const pendingBookings = bookings.filter((b) => b.status === 'pending')
  const confirmedUpcoming = bookings.filter((b) => b.status === 'confirmed' && b.booking_date >= todayKey)

  const isFiltering = searchQuery.trim() !== '' || statusFilter !== 'all' || dateFilter !== null
  const searchResults = useMemo(() => {
    if (!isFiltering) return []
    const q = searchQuery.trim().toLowerCase()
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (dateFilter === 'today' && (b.status === 'cancelled' || b.booking_date !== todayKey)) return false
      if (dateFilter === 'month' && (b.status === 'cancelled' || !b.booking_date.startsWith(monthPrefix))) return false
      if (!q) return true
      return (b.client_name || '').toLowerCase().includes(q) || (b.client_phone || '').includes(q)
    })
  }, [bookings, isFiltering, searchQuery, statusFilter, dateFilter, todayKey, monthPrefix])

  function findOverlap(dateKey, start, end, excludeId) {
    return bookings.find(
      (b) =>
        b.id !== excludeId &&
        b.status !== 'cancelled' &&
        b.booking_date === dateKey &&
        overlaps(start, end, b.start_time, b.end_time)
    )
  }

  async function handleAddBooking(e) {
    e.preventDefault()
    setFormError('')

    if (!form.booking_date || !form.start_time || !form.end_time) {
      setFormError('Please fill in all fields')
      return
    }
    if (timeToMinutes(form.start_time) >= timeToMinutes(form.end_time)) {
      setFormError('Start time must be before end time')
      return
    }
    if (form.client_name && !isValidClientName(form.client_name)) {
      setFormError('Please enter a valid name')
      return
    }
    if (form.client_phone && !isValidBangladeshiPhone(form.client_phone)) {
      setFormError('Please enter a valid Bangladeshi phone number (e.g. 01712345678)')
      return
    }

    const clash = findOverlap(form.booking_date, form.start_time, form.end_time, null)
    if (clash) {
      setFormError(`This time is already booked (${formatTimeLabel(clash.start_time.slice(0, 5))}–${formatTimeLabel(clash.end_time.slice(0, 5))})`)
      return
    }

    setSaving(true)
    const { error } = await supabase.from('bookings').insert({
      booking_date: form.booking_date,
      start_time: form.start_time,
      end_time: form.end_time,
      client_name: form.client_name || null,
      client_phone: form.client_phone || null,
      package_name: form.package_name || null,
      status: 'confirmed',
    })
    setSaving(false)

    if (error) {
      if (error.code === '23P01' || error.message?.includes('overlap')) {
        setFormError('This time was just booked by someone else. Please refresh and try again.')
      } else {
        setFormError('Could not save: ' + error.message)
      }
      return
    }

    setForm(emptyForm)
    setAddOpen(false)
    loadBookings()
  }

  async function handleSaveEdit() {
    setEditError('')
    const f = editForm

    if (!f.booking_date || !f.start_time || !f.end_time) {
      setEditError('Please fill in all fields')
      return
    }
    if (timeToMinutes(f.start_time) >= timeToMinutes(f.end_time)) {
      setEditError('Start time must be before end time')
      return
    }
    if (f.client_name && !isValidClientName(f.client_name)) {
      setEditError('Please enter a valid name')
      return
    }
    if (f.client_phone && !isValidBangladeshiPhone(f.client_phone)) {
      setEditError('Please enter a valid Bangladeshi phone number (e.g. 01712345678)')
      return
    }

    const clash = findOverlap(f.booking_date, f.start_time, f.end_time, editingId)
    if (clash) {
      setEditError(`This time is already booked (${formatTimeLabel(clash.start_time.slice(0, 5))}–${formatTimeLabel(clash.end_time.slice(0, 5))})`)
      return
    }

    setEditSaving(true)
    const { error } = await supabase
      .from('bookings')
      .update({
        booking_date: f.booking_date,
        start_time: f.start_time,
        end_time: f.end_time,
        client_name: f.client_name || null,
        client_phone: f.client_phone || null,
        package_name: f.package_name || null,
      })
      .eq('id', editingId)
    setEditSaving(false)

    if (error) {
      if (error.code === '23P01') {
        setEditError('This time conflicts with another booking.')
      } else {
        setEditError('Could not save: ' + error.message)
      }
      return
    }

    cancelEdit()
    loadBookings()
  }

  async function handleCancel(id) {
    if (!confirm('Cancel this booking?')) return
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    loadBookings()
  }

  async function handleConfirm(id) {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id)
    loadBookings()
  }

  async function handleReject(id) {
    if (!confirm('Reject this request?')) return
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    loadBookings()
  }

  async function handleHardDelete(id) {
    if (!confirm('Permanently delete this booking? This cannot be undone.')) return
    await supabase.from('bookings').delete().eq('id', id)
    loadBookings()
  }

  function bookingRowProps(b) {
    const isEditing = editingId === b.id
    return {
      b,
      isExpanded: expandedIds.has(b.id),
      onToggle: () => toggleExpanded(b.id),
      isEditing,
      editForm: isEditing ? editForm : null,
      onEditFormChange: setEditForm,
      editError: isEditing ? editError : '',
      editSaving,
      onStartEdit: () => startEdit(b),
      onSaveEdit: handleSaveEdit,
      onCancelEdit: cancelEdit,
      onConfirm: () => handleConfirm(b.id),
      onReject: () => handleReject(b.id),
      onCancel: () => handleCancel(b.id),
      onDelete: () => handleHardDelete(b.id),
    }
  }

  if (!authChecked) {
    return <p className="font-sans text-sm text-ink/40 py-12 text-center">Loading…</p>
  }

  if (!session) {
    return (
      <div className="font-sans max-w-sm mx-auto mt-12">
        <form onSubmit={handleLogin} className="bg-white border border-mist/70 shadow-sm rounded-2xl p-6">
          <p className="font-display text-xl mb-1">Team Login</p>
          <p className="text-sm text-ink/50 mb-4">Log in to add or manage bookings</p>
          <div className="space-y-2.5 mb-3.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={inputClass()}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={inputClass()}
            />
          </div>
          {loginError && (
            <p className="text-sm text-clay bg-clay/10 border border-clay/20 rounded-xl px-3.5 py-2.5 mb-3.5">{loginError}</p>
          )}
          <button disabled={loggingIn} className="w-full bg-pine text-paper rounded-xl py-2.5 font-semibold shadow-sm disabled:opacity-50">
            {loggingIn ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="font-sans max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <p className="font-display text-base text-ink">Admin Panel</p>
        <button onClick={handleLogout} className="flex items-center gap-1 text-[10px] font-medium text-ink/50 hover:text-clay transition-colors">
          <IconLogOut className="h-3 w-3" /> Log Out
        </button>
      </div>

      {/* Quick stats (also act as filters) */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <button
          onClick={() => {
            setStatusFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))
            setDateFilter(null)
          }}
          className={`bg-white border shadow-sm rounded-lg p-2 text-center transition-all ${
            statusFilter === 'pending' ? 'border-amber-400 ring-2 ring-amber-300 bg-amber-50' : 'border-mist/70'
          }`}
        >
          <p className="text-lg font-display text-amber-600">{stats.pending}</p>
          <p className="text-[9px] uppercase tracking-wide text-ink/45 font-semibold mt-0.5">Pending</p>
        </button>
        <button
          onClick={() => {
            setDateFilter((prev) => (prev === 'today' ? null : 'today'))
            setStatusFilter('all')
          }}
          className={`bg-white border shadow-sm rounded-lg p-2 text-center transition-all ${
            dateFilter === 'today' ? 'border-pine ring-2 ring-pine/30 bg-pine/5' : 'border-mist/70'
          }`}
        >
          <p className="text-lg font-display text-pine">{stats.today}</p>
          <p className="text-[9px] uppercase tracking-wide text-ink/45 font-semibold mt-0.5">Today's Bookings</p>
        </button>
        <button
          onClick={() => {
            setDateFilter((prev) => (prev === 'month' ? null : 'month'))
            setStatusFilter('all')
          }}
          className={`bg-white border shadow-sm rounded-lg p-2 text-center transition-all ${
            dateFilter === 'month' ? 'border-ink/40 ring-2 ring-ink/20 bg-mist/20' : 'border-mist/70'
          }`}
        >
          <p className="text-lg font-display text-ink">{stats.month}</p>
          <p className="text-[9px] uppercase tracking-wide text-ink/45 font-semibold mt-0.5">This Month</p>
        </button>
      </div>

      {/* Add booking (collapsible) */}
      <div className="bg-white border border-mist/70 shadow-sm rounded-xl p-2.5 mb-2">
        <button onClick={() => setAddOpen((v) => !v)} className="w-full flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <IconPlus className="h-3.5 w-3.5 text-pine" /> Add New Booking
          </span>
          <IconChevronDown className={`h-3.5 w-3.5 text-ink/40 transition-transform ${addOpen ? 'rotate-180' : ''}`} />
        </button>
        {addOpen && (
          <form onSubmit={handleAddBooking} className="mt-3 space-y-2">
            <input
              type="date"
              value={form.booking_date}
              onChange={(e) => setForm({ ...form, booking_date: e.target.value })}
              className={inputClass()}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <select value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className={inputClass()}>
                <option value="">Start Time</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className={inputClass()}>
                <option value="">End Time</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              placeholder="Client Name (optional)"
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              className={inputClass()}
            />
            <input
              type="tel"
              placeholder="Phone Number (optional)"
              value={form.client_phone}
              onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
              className={inputClass()}
            />
            <input
              type="text"
              placeholder="Package (optional)"
              value={form.package_name}
              onChange={(e) => setForm({ ...form, package_name: e.target.value })}
              className={inputClass()}
            />
            {formError && (
              <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3 py-2">
                <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {formError}
              </p>
            )}
            <button disabled={saving} className="w-full bg-pine text-paper rounded-xl py-2 text-sm font-semibold shadow-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Confirm Booking'}
            </button>
          </form>
        )}
      </div>

      {/* Search / filter */}
      <div className="bg-white border border-pine/20 shadow-sm rounded-xl p-2 mb-2">
        <p className="text-[9px] uppercase tracking-wide text-pine font-bold mb-1.5 px-0.5">Search & Filter</p>
        <div className="space-y-1.5">
          <div className="relative">
            <IconSearch className="h-3.5 w-3.5 text-pine/50 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or number"
              className="w-full bg-pine/5 border border-pine/25 rounded-lg pl-8 pr-7 py-1.5 text-xs outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/60"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-pine/5 border border-pine/25 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-pine font-medium text-pine"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loadingBookings ? (
        <p className="text-xs text-ink/40 py-6 text-center">Loading…</p>
      ) : isFiltering ? (
        <>
          <p className="text-sm font-semibold mb-2">Search Results ({searchResults.length})</p>
          {searchResults.length === 0 ? (
            <p className="flex flex-col items-center gap-2 text-xs text-ink/40 py-8 text-center">
              <IconInbox className="h-5 w-5" /> No bookings found
            </p>
          ) : (
            <ul className="space-y-1.5">
              {searchResults.map((b) => (
                <BookingRow key={b.id} {...bookingRowProps(b)} />
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {pendingBookings.length > 0 && (
            <>
              <p className="text-sm font-semibold mb-2">Booking Requests (Pending)</p>
              <ul className="space-y-1.5 mb-4">
                {pendingBookings.map((b) => (
                  <BookingRow key={b.id} {...bookingRowProps(b)} />
                ))}
              </ul>
            </>
          )}

          <p className="text-sm font-semibold mb-2">Upcoming Bookings</p>
          <ul className="space-y-1.5">
            {confirmedUpcoming.length === 0 && <p className="text-xs text-ink/40">No bookings</p>}
            {confirmedUpcoming.map((b) => (
              <BookingRow key={b.id} {...bookingRowProps(b)} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
