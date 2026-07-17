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
} from './icons.jsx'

const TIME_OPTIONS = generateTimeOptions()

const STATUS_META = {
  pending: { label: 'অপেক্ষমান', className: 'bg-clay/10 text-clay border-clay/30' },
  confirmed: { label: 'কনফার্মড', className: 'bg-pine/10 text-pine border-pine/30' },
  cancelled: { label: 'বাতিল', className: 'bg-mist/50 text-ink/40 border-mist' },
}

const emptyForm = { booking_date: '', start_time: '', end_time: '', client_name: '', client_phone: '', package_name: '' }

function inputClass() {
  return 'w-full border border-mist rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15'
}

function formatBookingDate(dateKey) {
  return fromDateKey(dateKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.confirmed
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 shrink-0 ${meta.className}`}>
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
          <option value="">শুরুর সময়</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select value={editForm.end_time} onChange={(e) => onChange({ ...editForm, end_time: e.target.value })} className={inputClass()}>
          <option value="">শেষের সময়</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <input
        type="text"
        placeholder="ক্লায়েন্টের নাম"
        value={editForm.client_name}
        onChange={(e) => onChange({ ...editForm, client_name: e.target.value })}
        className={inputClass()}
      />
      <input
        type="tel"
        placeholder="ফোন নম্বর"
        value={editForm.client_phone}
        onChange={(e) => onChange({ ...editForm, client_phone: e.target.value })}
        className={inputClass()}
      />
      <input
        type="text"
        placeholder="প্যাকেজ"
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
          বাতিল
        </button>
        <button
          type="button"
          disabled={editSaving}
          onClick={onSave}
          className="flex-1 bg-pine text-paper rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {editSaving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
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
}) {
  return (
    <li className={`bg-white border rounded-2xl overflow-hidden text-sm shadow-sm ${b.status === 'pending' ? 'border-clay/30' : 'border-mist/70'}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left">
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center h-8 w-8 rounded-full bg-pine/10 text-pine shrink-0">
            <IconUser className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="font-medium truncate block">{b.client_name || 'নাম নেই'}</span>
            <span className="text-xs text-ink/45">
              {formatBookingDate(b.booking_date)} · {formatTimeLabel(b.start_time.slice(0, 5))}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <StatusBadge status={b.status} />
          <IconChevronDown className={`h-4 w-4 text-ink/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-mist/60">
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
              <div className="space-y-1.5 text-xs text-ink/70 mb-3 mt-2">
                <p className="flex items-center gap-1.5">
                  <IconCalendar className="h-3.5 w-3.5 text-ink/40 shrink-0" />
                  {formatBookingDate(b.booking_date)}, {formatTimeLabel(b.start_time.slice(0, 5))} – {formatTimeLabel(b.end_time.slice(0, 5))}
                </p>
                <p className="flex items-center gap-1.5">
                  <IconPhone className="h-3.5 w-3.5 text-ink/40 shrink-0" />
                  {b.client_phone || 'দেওয়া হয়নি'}
                </p>
                <p className="flex items-center gap-1.5">
                  <IconTag className="h-3.5 w-3.5 text-ink/40 shrink-0" />
                  {b.package_name || 'উল্লেখ নেই'}
                </p>
              </div>
              <div className="flex gap-2">
                {b.status === 'pending' && (
                  <>
                    <button onClick={onReject} className="flex-1 border border-mist rounded-lg py-1.5 text-xs font-medium text-ink/60">
                      প্রত্যাখ্যান
                    </button>
                    <button onClick={onConfirm} className="flex-1 bg-pine text-paper rounded-lg py-1.5 text-xs font-medium">
                      কনফার্ম করুন
                    </button>
                  </>
                )}
                {b.status === 'confirmed' && (
                  <button onClick={onCancel} className="flex-1 border border-clay/30 text-clay rounded-lg py-1.5 text-xs font-medium">
                    বাতিল করুন
                  </button>
                )}
                {b.status !== 'cancelled' && (
                  <button
                    onClick={onStartEdit}
                    className="flex items-center justify-center gap-1 flex-1 border border-mist rounded-lg py-1.5 text-xs font-medium text-ink/70"
                  >
                    <IconEdit className="h-3.5 w-3.5" /> এডিট
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
      setLoginError('ইমেইল বা পাসওয়ার্ড ভুল')
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

  const isFiltering = searchQuery.trim() !== '' || statusFilter !== 'all'
  const searchResults = useMemo(() => {
    if (!isFiltering) return []
    const q = searchQuery.trim().toLowerCase()
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (!q) return true
      return (b.client_name || '').toLowerCase().includes(q) || (b.client_phone || '').includes(q)
    })
  }, [bookings, isFiltering, searchQuery, statusFilter])

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
      setFormError('সব ফিল্ড পূরণ করুন')
      return
    }
    if (timeToMinutes(form.start_time) >= timeToMinutes(form.end_time)) {
      setFormError('শুরুর সময় শেষের সময়ের আগে হতে হবে')
      return
    }
    if (form.client_name && !isValidClientName(form.client_name)) {
      setFormError('সঠিক নাম দিন')
      return
    }
    if (form.client_phone && !isValidBangladeshiPhone(form.client_phone)) {
      setFormError('সঠিক বাংলাদেশী ফোন নম্বর দিন (যেমন 01712345678)')
      return
    }

    const clash = findOverlap(form.booking_date, form.start_time, form.end_time, null)
    if (clash) {
      setFormError(`এই সময় ইতিমধ্যে বুকড (${formatTimeLabel(clash.start_time.slice(0, 5))}–${formatTimeLabel(clash.end_time.slice(0, 5))})`)
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
        setFormError('এই সময় ইতিমধ্যে অন্য কেউ বুক করে ফেলেছে। রিফ্রেশ করে আবার চেষ্টা করুন।')
      } else {
        setFormError('সেভ করা যায়নি: ' + error.message)
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
      setEditError('সব ফিল্ড পূরণ করুন')
      return
    }
    if (timeToMinutes(f.start_time) >= timeToMinutes(f.end_time)) {
      setEditError('শুরুর সময় শেষের সময়ের আগে হতে হবে')
      return
    }
    if (f.client_name && !isValidClientName(f.client_name)) {
      setEditError('সঠিক নাম দিন')
      return
    }
    if (f.client_phone && !isValidBangladeshiPhone(f.client_phone)) {
      setEditError('সঠিক বাংলাদেশী ফোন নম্বর দিন (যেমন 01712345678)')
      return
    }

    const clash = findOverlap(f.booking_date, f.start_time, f.end_time, editingId)
    if (clash) {
      setEditError(`এই সময় ইতিমধ্যে বুকড (${formatTimeLabel(clash.start_time.slice(0, 5))}–${formatTimeLabel(clash.end_time.slice(0, 5))})`)
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
        setEditError('এই সময় ইতিমধ্যে অন্য বুকিং এর সাথে সাংঘর্ষিক।')
      } else {
        setEditError('সেভ করা যায়নি: ' + error.message)
      }
      return
    }

    cancelEdit()
    loadBookings()
  }

  async function handleCancel(id) {
    if (!confirm('এই বুকিং বাতিল করবেন?')) return
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    loadBookings()
  }

  async function handleConfirm(id) {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id)
    loadBookings()
  }

  async function handleReject(id) {
    if (!confirm('এই রিকোয়েস্ট প্রত্যাখ্যান করবেন?')) return
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
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
    }
  }

  if (!authChecked) {
    return <p className="text-sm text-ink/40 py-12 text-center">লোড হচ্ছে…</p>
  }

  if (!session) {
    return (
      <div className="max-w-sm mx-auto mt-12">
        <form onSubmit={handleLogin} className="bg-white border border-mist/70 shadow-sm rounded-2xl p-6">
          <p className="font-display text-xl mb-1">টিম লগইন</p>
          <p className="text-sm text-ink/50 mb-4">বুকিং যোগ/বাতিল করতে লগইন করুন</p>
          <div className="space-y-2.5 mb-3.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ইমেইল"
              className={inputClass()}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="পাসওয়ার্ড"
              className={inputClass()}
            />
          </div>
          {loginError && (
            <p className="text-sm text-clay bg-clay/10 border border-clay/20 rounded-xl px-3.5 py-2.5 mb-3.5">{loginError}</p>
          )}
          <button disabled={loggingIn} className="w-full bg-pine text-paper rounded-xl py-2.5 font-semibold shadow-sm disabled:opacity-50">
            {loggingIn ? 'ঢুকছে…' : 'ঢুকুন'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <p className="font-display text-2xl text-ink">এডমিন প্যানেল</p>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-clay transition-colors">
          <IconLogOut className="h-3.5 w-3.5" /> লগআউট
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <div className="bg-white border border-mist/70 shadow-sm rounded-2xl p-3.5 text-center">
          <p className="text-2xl font-display text-clay">{stats.pending}</p>
          <p className="text-[10px] uppercase tracking-wide text-ink/45 font-semibold mt-0.5">অপেক্ষমান</p>
        </div>
        <div className="bg-white border border-mist/70 shadow-sm rounded-2xl p-3.5 text-center">
          <p className="text-2xl font-display text-pine">{stats.today}</p>
          <p className="text-[10px] uppercase tracking-wide text-ink/45 font-semibold mt-0.5">আজকের বুকিং</p>
        </div>
        <div className="bg-white border border-mist/70 shadow-sm rounded-2xl p-3.5 text-center">
          <p className="text-2xl font-display text-ink">{stats.month}</p>
          <p className="text-[10px] uppercase tracking-wide text-ink/45 font-semibold mt-0.5">এই মাসে</p>
        </div>
      </div>

      {/* Add booking (collapsible) */}
      <div className="bg-white border border-mist/70 shadow-sm rounded-2xl p-4 mb-5">
        <button onClick={() => setAddOpen((v) => !v)} className="w-full flex items-center justify-between">
          <span className="font-display text-lg flex items-center gap-2">
            <IconPlus className="h-4 w-4 text-pine" /> নতুন বুকিং যোগ করুন
          </span>
          <IconChevronDown className={`h-4 w-4 text-ink/40 transition-transform ${addOpen ? 'rotate-180' : ''}`} />
        </button>
        {addOpen && (
          <form onSubmit={handleAddBooking} className="mt-4 space-y-2.5">
            <input
              type="date"
              value={form.booking_date}
              onChange={(e) => setForm({ ...form, booking_date: e.target.value })}
              className={inputClass()}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <select value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className={inputClass()}>
                <option value="">শুরুর সময়</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className={inputClass()}>
                <option value="">শেষের সময়</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              placeholder="ক্লায়েন্টের নাম (ঐচ্ছিক)"
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              className={inputClass()}
            />
            <input
              type="tel"
              placeholder="ফোন নম্বর (ঐচ্ছিক)"
              value={form.client_phone}
              onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
              className={inputClass()}
            />
            <input
              type="text"
              placeholder="প্যাকেজ (ঐচ্ছিক)"
              value={form.package_name}
              onChange={(e) => setForm({ ...form, package_name: e.target.value })}
              className={inputClass()}
            />
            {formError && (
              <p className="flex items-start gap-2 text-sm text-clay bg-clay/10 border border-clay/20 rounded-xl px-3.5 py-2.5">
                <IconAlert className="h-4 w-4 shrink-0 mt-0.5" /> {formError}
              </p>
            )}
            <button disabled={saving} className="w-full bg-pine text-paper rounded-xl py-2.5 font-semibold shadow-sm disabled:opacity-50">
              {saving ? 'সেভ হচ্ছে…' : 'বুকিং কনফার্ম করুন'}
            </button>
          </form>
        )}
      </div>

      {/* Search / filter */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <IconSearch className="h-4 w-4 text-ink/35 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম বা ফোন নম্বর দিয়ে খুঁজুন"
            className="w-full border border-mist rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/60"
            >
              <IconX className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-mist rounded-xl px-3 text-sm outline-none focus:border-pine"
        >
          <option value="all">সব স্ট্যাটাস</option>
          <option value="pending">অপেক্ষমান</option>
          <option value="confirmed">কনফার্মড</option>
          <option value="cancelled">বাতিল</option>
        </select>
      </div>

      {loadingBookings ? (
        <p className="text-sm text-ink/40 py-8 text-center">লোড হচ্ছে…</p>
      ) : isFiltering ? (
        <>
          <p className="font-display text-lg mb-3">খোঁজার ফলাফল ({searchResults.length})</p>
          {searchResults.length === 0 ? (
            <p className="flex flex-col items-center gap-2 text-sm text-ink/40 py-10 text-center">
              <IconInbox className="h-6 w-6" /> কোনো বুকিং পাওয়া যায়নি
            </p>
          ) : (
            <ul className="space-y-2">
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
              <p className="font-display text-lg mb-3">বুকিং রিকোয়েস্ট (অপেক্ষমান)</p>
              <ul className="space-y-2 mb-6">
                {pendingBookings.map((b) => (
                  <BookingRow key={b.id} {...bookingRowProps(b)} />
                ))}
              </ul>
            </>
          )}

          <p className="font-display text-lg mb-3">আসন্ন বুকিং</p>
          <ul className="space-y-2">
            {confirmedUpcoming.length === 0 && <p className="text-sm text-ink/40">কোনো বুকিং নেই</p>}
            {confirmedUpcoming.map((b) => (
              <BookingRow key={b.id} {...bookingRowProps(b)} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
