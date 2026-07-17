import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { timeToMinutes, overlaps, toDateKey, fromDateKey, formatTimeLabel, generateTimeOptions } from '../lib/time.js'
import { isValidBangladeshiPhone, isValidClientName } from '../lib/validation.js'
import { PAYMENT_METHODS, PAYMENT_COLLECTORS } from '../lib/packages.js'
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
  IconSettings,
  IconCheckCircle,
} from './icons.jsx'

const TIME_OPTIONS = generateTimeOptions()
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: formatTimeLabel(`${String(h).padStart(2, '0')}:00`),
}))

const STATUS_META = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelled: { label: 'Cancelled', className: 'bg-[#E0E0E0]/50 text-[#333333]/40 border-[#E0E0E0]' },
}

const emptyForm = { booking_date: '', start_time: '', end_time: '', client_name: '', client_phone: '', package_name: '', total_amount: '' }
const emptyPaymentForm = { amount: '', method: '', collector: '' }

function inputClass() {
  return 'w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-xs outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15'
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

function formatBookingDate(dateKey) {
  return fromDateKey(dateKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMoney(n) {
  return `${Number(n).toLocaleString('en-US')} Tk`
}

// payments.method is stored lowercase (DB check constraint); map back to
// the display-cased label shown in the dropdown (e.g. "bkash" -> "bKash").
const METHOD_DISPLAY = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.toLowerCase(), m]))
function formatMethod(method) {
  return METHOD_DISPLAY[method] || method
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
      <input
        type="number"
        placeholder="Total Amount (Tk)"
        value={editForm.total_amount}
        onChange={(e) => onChange({ ...editForm, total_amount: e.target.value })}
        className={inputClass()}
      />
      {editError && (
        <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3.5 py-2.5">
          <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {editError}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 border border-[#E0E0E0] rounded-lg py-1.5 text-xs font-medium text-[#333333]/60">
          Cancel
        </button>
        <button
          type="button"
          disabled={editSaving}
          onClick={onSave}
          className="flex-1 bg-pine text-white rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {editSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function BookingRow({
  b,
  dueAmount,
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
  onOpenPayment,
  onOpenHistory,
}) {
  return (
    <li className={`bg-white border rounded-xl overflow-hidden text-xs shadow-sm ${b.status === 'pending' ? 'border-amber-300' : 'border-[#E0E0E0]/70'}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left">
        <span className="flex items-center gap-2 min-w-0">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-pine/10 text-pine shrink-0">
            <IconUser className="h-3 w-3" />
          </span>
          <span className="min-w-0">
            <span className="text-xs font-semibold truncate block">{b.client_name || 'No name'}</span>
            <span className="text-[10px] text-[#333333]/45">
              {formatBookingDate(b.booking_date)} · {formatTimeLabel(b.start_time.slice(0, 5))}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {dueAmount != null && dueAmount > 0 && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-clay bg-clay/10 border border-clay/20 rounded-full px-1.5 py-0.5">
              Due {formatMoney(dueAmount)}
            </span>
          )}
          <StatusBadge status={b.status} />
          <IconChevronDown className={`h-3.5 w-3.5 text-[#333333]/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isExpanded && (
        <div className="px-2.5 pb-2.5 pt-0.5 border-t border-[#E0E0E0]/60">
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
              <div className="space-y-1 text-[10px] text-[#333333]/70 mb-2 mt-1.5">
                <p className="flex items-center gap-1.5">
                  <IconCalendar className="h-3 w-3 text-[#333333]/40 shrink-0" />
                  {formatBookingDate(b.booking_date)}, {formatTimeLabel(b.start_time.slice(0, 5))} – {formatTimeLabel(b.end_time.slice(0, 5))}
                </p>
                <p className="flex items-center gap-1.5">
                  <IconPhone className="h-3 w-3 text-[#333333]/40 shrink-0" />
                  {b.client_phone || 'Not provided'}
                </p>
                <p className="flex items-center gap-1.5">
                  <IconTag className="h-3 w-3 text-[#333333]/40 shrink-0" />
                  {b.package_name || 'Not specified'}
                </p>
                {b.total_amount != null && (
                  <p className="flex items-center gap-1.5">
                    Total {formatMoney(b.total_amount)}
                    {dueAmount != null && (
                      <span className={dueAmount > 0 ? 'text-clay font-semibold' : 'text-pine font-semibold'}>
                        · {dueAmount > 0 ? `Due ${formatMoney(dueAmount)}` : 'Fully Paid'}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                {(b.status === 'pending' || b.status === 'confirmed') && (
                  <div className="flex gap-1.5">
                    {b.status === 'pending' && (
                      <>
                        <button onClick={onReject} className="flex-1 border border-[#E0E0E0] rounded-lg py-1 text-[10px] font-medium text-[#333333]/60">
                          Reject
                        </button>
                        <button onClick={onConfirm} className="flex-1 bg-pine text-white rounded-lg py-1 text-[10px] font-medium">
                          Confirm
                        </button>
                      </>
                    )}
                    {b.status === 'confirmed' && (
                      <button onClick={onCancel} className="flex-1 border border-clay/30 text-clay rounded-lg py-1 text-[10px] font-medium">
                        Cancel Booking
                      </button>
                    )}
                  </div>
                )}
                <div className="flex gap-1.5">
                  {b.status !== 'cancelled' && (
                    <button onClick={onOpenPayment} className="flex-1 border border-pine/30 text-pine rounded-lg py-1 text-[10px] font-medium">
                      Add Payment
                    </button>
                  )}
                  <button onClick={onOpenHistory} className="flex-1 border border-[#E0E0E0] rounded-lg py-1 text-[10px] font-medium text-[#333333]/70">
                    History
                  </button>
                  {b.status !== 'cancelled' && (
                    <button onClick={onStartEdit} className="flex-1 border border-[#E0E0E0] rounded-lg py-1 text-[10px] font-medium text-[#333333]/70">
                      Edit
                    </button>
                  )}
                  {b.status === 'cancelled' && (
                    <button onClick={onDelete} className="flex-1 border border-clay/30 text-clay rounded-lg py-1 text-[10px] font-medium">
                      Delete Permanently
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-[#333333]/40 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="font-sans w-full max-w-sm bg-[#F9F7F2] rounded-xl shadow-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-bold text-[#333333]">{title}</p>
          <button onClick={onClose} aria-label="Close" className="text-[#333333]/40 hover:text-[#333333]">
            <IconX className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PaymentModal({ booking, form, onChange, error, saving, onSave, onClose }) {
  return (
    <Modal title={`Add Payment — ${booking.client_name || 'No name'}`} onClose={onClose}>
      <div className="space-y-2.5">
        <input
          type="number"
          placeholder="Amount (Tk)"
          value={form.amount}
          onChange={(e) => onChange({ ...form, amount: e.target.value })}
          className={inputClass()}
        />
        <select value={form.method} onChange={(e) => onChange({ ...form, method: e.target.value })} className={inputClass()}>
          <option value="">Payment Method</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={form.collector} onChange={(e) => onChange({ ...form, collector: e.target.value })} className={inputClass()}>
          <option value="">Payment Collector</option>
          {PAYMENT_COLLECTORS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {error && (
          <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3.5 py-2.5">
            <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-[#E0E0E0] rounded-lg py-2 text-xs font-medium text-[#333333]/60">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="flex-1 bg-pine text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Payment'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function HistoryModal({ booking, payments, statusLogs, onClose }) {
  const entries = useMemo(() => {
    const paymentEntries = payments
      .filter((p) => p.booking_id === booking.id)
      .map((p) => ({ kind: 'payment', at: p.created_at, amount: p.amount, method: p.method, collector: p.collector }))
    const statusEntries = statusLogs
      .filter((l) => l.booking_id === booking.id)
      .map((l) => ({ kind: 'status', at: l.changed_at, from: l.from_status, to: l.to_status, by: l.changed_by }))
    return [...paymentEntries, ...statusEntries].sort((a, b) => new Date(b.at) - new Date(a.at))
  }, [payments, statusLogs, booking.id])

  return (
    <Modal title={`History — ${booking.client_name || 'No name'}`} onClose={onClose}>
      {entries.length === 0 ? (
        <p className="flex flex-col items-center gap-2 text-xs text-[#333333]/40 py-8 text-center">
          <IconInbox className="h-6 w-6" /> No activity recorded yet.
        </p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {entries.map((e, i) => (
            <li key={i} className="bg-white border border-[#E0E0E0]/70 rounded-lg px-3 py-2 text-xs">
              {e.kind === 'payment' ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-pine">{formatMoney(e.amount)}</span>
                  <span className="text-[10px] text-[#333333]/55 text-right">
                    {formatMethod(e.method)} · {e.collector}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold text-[#333333]">
                    <IconCheckCircle className="h-3.5 w-3.5 shrink-0 text-[#333333]/50" />
                    {e.from ? `${e.from} → ${e.to}` : `Created (${e.to})`}
                  </span>
                  <span className="text-[10px] text-[#333333]/55 text-right">{e.by || 'Unknown'}</span>
                </div>
              )}
              <p className="text-[9px] text-[#333333]/40 mt-1">
                {new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
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
  const [payments, setPayments] = useState([])
  const [statusLogs, setStatusLogs] = useState([])

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [paymentModalBooking, setPaymentModalBooking] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)

  const [historyModalBooking, setHistoryModalBooking] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState(null) // null | 'today' | 'month'

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [packages, setPackages] = useState([])
  const [editingPackageId, setEditingPackageId] = useState(null)
  const [packageEditForm, setPackageEditForm] = useState(null)
  const [packageSaving, setPackageSaving] = useState(false)

  const [hoursForm, setHoursForm] = useState({ start: 9, end: 23 })
  const [hoursSaving, setHoursSaving] = useState(false)

  const [offDays, setOffDays] = useState([])
  const [offDayMonth, setOffDayMonth] = useState(startOfMonth(new Date()))

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
      total_amount: b.total_amount ?? '',
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
    loadPayments()
    loadStatusLogs()
    loadPackages()
    loadSettings()
    loadOffDays()
  }, [session])

  async function loadBookings() {
    setLoadingBookings(true)
    const { data } = await supabase.from('bookings').select('*').order('booking_date').order('start_time')
    setBookings(data || [])
    setLoadingBookings(false)
  }

  async function loadPayments() {
    const { data } = await supabase.from('payments').select('*').order('created_at')
    setPayments(data || [])
  }

  async function loadStatusLogs() {
    const { data } = await supabase.from('booking_status_log').select('*').order('changed_at')
    setStatusLogs(data || [])
  }

  async function loadPackages() {
    const { data } = await supabase.from('packages').select('*').order('sort_order')
    setPackages(data || [])
  }

  async function loadSettings() {
    const { data } = await supabase.from('studio_settings').select('*').single()
    if (data) setHoursForm({ start: data.business_start_hour, end: data.business_end_hour })
  }

  async function loadOffDays() {
    const { data } = await supabase.from('off_days').select('*').order('off_date')
    setOffDays(data || [])
  }

  const staffEmail = session?.user?.email || null

  const todayKey = toDateKey(new Date())
  const monthPrefix = todayKey.slice(0, 7)

  const paymentsByBooking = useMemo(() => {
    const map = {}
    for (const p of payments) {
      map[p.booking_id] = (map[p.booking_id] || 0) + Number(p.amount)
    }
    return map
  }, [payments])

  function dueAmountFor(b) {
    if (b.total_amount == null) return null
    return Math.max(0, Number(b.total_amount) - (paymentsByBooking[b.id] || 0))
  }

  const stats = useMemo(() => {
    const todayEarnings = payments
      .filter((p) => toDateKey(new Date(p.created_at)) === todayKey)
      .reduce((sum, p) => sum + Number(p.amount), 0)
    return {
      pending: bookings.filter((b) => b.status === 'pending').length,
      today: bookings.filter((b) => b.status !== 'cancelled' && b.booking_date === todayKey).length,
      todayEarnings,
      month: bookings.filter((b) => b.status !== 'cancelled' && b.booking_date.startsWith(monthPrefix)).length,
    }
  }, [bookings, payments, todayKey, monthPrefix])

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

  async function logStatusChange(booking, toStatus) {
    await supabase.from('booking_status_log').insert({
      booking_id: booking.id,
      from_status: booking.status,
      to_status: toStatus,
      changed_by: staffEmail,
    })
    loadStatusLogs()
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
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        booking_date: form.booking_date,
        start_time: form.start_time,
        end_time: form.end_time,
        client_name: form.client_name || null,
        client_phone: form.client_phone || null,
        package_name: form.package_name || null,
        total_amount: form.total_amount === '' ? null : Number(form.total_amount),
        status: 'confirmed',
      })
      .select()
      .single()
    setSaving(false)

    if (error) {
      if (error.code === '23P01' || error.message?.includes('overlap')) {
        setFormError('This time was just booked by someone else. Please refresh and try again.')
      } else {
        setFormError('Could not save: ' + error.message)
      }
      return
    }

    if (data) {
      await supabase.from('booking_status_log').insert({ booking_id: data.id, from_status: null, to_status: 'confirmed', changed_by: staffEmail })
      loadStatusLogs()
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
        total_amount: f.total_amount === '' ? null : Number(f.total_amount),
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
    const b = bookings.find((x) => x.id === id)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    if (b) await logStatusChange(b, 'cancelled')
    loadBookings()
  }

  async function handleConfirm(id) {
    const b = bookings.find((x) => x.id === id)
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id)
    if (b) await logStatusChange(b, 'confirmed')
    loadBookings()
  }

  async function handleReject(id) {
    if (!confirm('Reject this request?')) return
    const b = bookings.find((x) => x.id === id)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    if (b) await logStatusChange(b, 'cancelled')
    loadBookings()
  }

  async function handleHardDelete(id) {
    if (!confirm('Permanently delete this booking? This cannot be undone.')) return
    await supabase.from('bookings').delete().eq('id', id)
    loadBookings()
  }

  function openPaymentModal(b) {
    setPaymentError('')
    setPaymentForm(emptyPaymentForm)
    setPaymentModalBooking(b)
  }

  async function handleAddPayment() {
    setPaymentError('')
    const amt = parseFloat(paymentForm.amount)
    if (!amt || amt <= 0) {
      setPaymentError('Enter a valid amount')
      return
    }
    if (!paymentForm.method || !paymentForm.collector) {
      setPaymentError('Select a payment method and collector')
      return
    }
    setPaymentSaving(true)
    const { error } = await supabase.from('payments').insert({
      booking_id: paymentModalBooking.id,
      amount: amt,
      method: paymentForm.method.toLowerCase(),
      collector: paymentForm.collector,
      created_by: staffEmail,
    })
    setPaymentSaving(false)
    if (error) {
      setPaymentError('Could not save: ' + error.message)
      return
    }
    setPaymentModalBooking(null)
    loadPayments()
  }

  function startEditPackage(p) {
    setEditingPackageId(p.id)
    setPackageEditForm({ label: p.label, rate_label: p.rate_label || '', hourly_rate: p.hourly_rate ?? '' })
  }

  async function savePackageEdit() {
    setPackageSaving(true)
    await supabase
      .from('packages')
      .update({
        label: packageEditForm.label,
        rate_label: packageEditForm.rate_label || null,
        hourly_rate: packageEditForm.hourly_rate === '' ? null : Number(packageEditForm.hourly_rate),
      })
      .eq('id', editingPackageId)
    setPackageSaving(false)
    setEditingPackageId(null)
    loadPackages()
  }

  async function saveHours() {
    setHoursSaving(true)
    await supabase
      .from('studio_settings')
      .update({ business_start_hour: Number(hoursForm.start), business_end_hour: Number(hoursForm.end) })
      .eq('id', true)
    setHoursSaving(false)
    loadSettings()
  }

  async function toggleOffDay(dateKey) {
    const existing = offDays.find((d) => d.off_date === dateKey)
    if (existing) {
      await supabase.from('off_days').delete().eq('off_date', dateKey)
    } else {
      await supabase.from('off_days').insert({ off_date: dateKey })
    }
    loadOffDays()
  }

  const offDayMonthCells = useMemo(() => {
    const totalDays = daysInMonth(offDayMonth)
    const leadingBlanks = startOfMonth(offDayMonth).getDay()
    const cells = Array.from({ length: leadingBlanks }, () => null)
    for (let day = 1; day <= totalDays; day++) {
      cells.push(new Date(offDayMonth.getFullYear(), offDayMonth.getMonth(), day))
    }
    return cells
  }, [offDayMonth])

  function bookingRowProps(b) {
    const isEditing = editingId === b.id
    return {
      b,
      dueAmount: dueAmountFor(b),
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
      onOpenPayment: () => openPaymentModal(b),
      onOpenHistory: () => setHistoryModalBooking(b),
    }
  }

  if (!authChecked) {
    return <p className="font-sans text-sm text-[#333333]/40 py-12 text-center">Loading…</p>
  }

  if (!session) {
    return (
      <div className="font-sans max-w-sm mx-auto mt-12">
        <form onSubmit={handleLogin} className="bg-white border border-[#E0E0E0]/70 shadow-sm rounded-2xl p-6">
          <p className="text-xl font-bold text-[#333333] mb-1">Team Login</p>
          <p className="text-sm text-[#333333]/50 mb-4">Log in to add or manage bookings</p>
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
          <button disabled={loggingIn} className="w-full bg-pine text-white rounded-xl py-2.5 font-semibold shadow-sm disabled:opacity-50">
            {loggingIn ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="font-sans max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <p className="text-base font-bold text-[#333333]">Admin Panel</p>
        <button onClick={handleLogout} className="flex items-center gap-1 text-[10px] font-medium text-[#333333]/50 hover:text-clay transition-colors">
          <IconLogOut className="h-3 w-3" /> Log Out
        </button>
      </div>

      {/* Dashboard overview */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <button
          onClick={() => {
            setStatusFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))
            setDateFilter(null)
          }}
          className={`bg-white border shadow-sm rounded-lg p-2 text-center transition-all ${
            statusFilter === 'pending' ? 'border-amber-400 ring-2 ring-amber-300 bg-amber-50' : 'border-[#E0E0E0]/70'
          }`}
        >
          <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
          <p className="text-[9px] uppercase tracking-wide text-[#333333]/45 font-semibold mt-0.5">Pending</p>
        </button>
        <button
          onClick={() => {
            setDateFilter((prev) => (prev === 'today' ? null : 'today'))
            setStatusFilter('all')
          }}
          className={`bg-white border shadow-sm rounded-lg p-2 text-center transition-all ${
            dateFilter === 'today' ? 'border-pine ring-2 ring-pine/30 bg-pine/5' : 'border-[#E0E0E0]/70'
          }`}
        >
          <p className="text-lg font-bold text-pine">{stats.today}</p>
          <p className="text-[9px] uppercase tracking-wide text-[#333333]/45 font-semibold mt-0.5">Today's Bookings</p>
        </button>
        <div className="bg-white border border-[#E0E0E0]/70 shadow-sm rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-[#333333]">{formatMoney(stats.todayEarnings)}</p>
          <p className="text-[9px] uppercase tracking-wide text-[#333333]/45 font-semibold mt-0.5">Today Earnings</p>
        </div>
        <button
          onClick={() => {
            setDateFilter((prev) => (prev === 'month' ? null : 'month'))
            setStatusFilter('all')
          }}
          className={`bg-white border shadow-sm rounded-lg p-2 text-center transition-all ${
            dateFilter === 'month' ? 'border-[#333333]/40 ring-2 ring-[#333333]/20 bg-mist/20' : 'border-[#E0E0E0]/70'
          }`}
        >
          <p className="text-lg font-bold text-[#333333]">{stats.month}</p>
          <p className="text-[9px] uppercase tracking-wide text-[#333333]/45 font-semibold mt-0.5">This Month</p>
        </button>
      </div>

      {/* Add booking (collapsible) */}
      <div className="bg-white border border-[#E0E0E0]/70 shadow-sm rounded-xl p-2.5 mb-2">
        <button onClick={() => setAddOpen((v) => !v)} className="w-full flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <IconPlus className="h-3.5 w-3.5 text-pine" /> Add New Booking
          </span>
          <IconChevronDown className={`h-3.5 w-3.5 text-[#333333]/40 transition-transform ${addOpen ? 'rotate-180' : ''}`} />
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
            <input
              type="number"
              placeholder="Total Amount (Tk, optional)"
              value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
              className={inputClass()}
            />
            {formError && (
              <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3 py-2">
                <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {formError}
              </p>
            )}
            <button disabled={saving} className="w-full bg-pine text-white rounded-xl py-2 text-sm font-semibold shadow-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Confirm Booking'}
            </button>
          </form>
        )}
      </div>

      {/* Studio settings (collapsible) */}
      <div className="bg-white border border-[#E0E0E0]/70 shadow-sm rounded-xl p-2.5 mb-2">
        <button onClick={() => setSettingsOpen((v) => !v)} className="w-full flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <IconSettings className="h-3.5 w-3.5 text-pine" /> Studio Settings
          </span>
          <IconChevronDown className={`h-3.5 w-3.5 text-[#333333]/40 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
        </button>
        {settingsOpen && (
          <div className="mt-3 space-y-4">
            {/* Package pricing */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#333333]/55 font-semibold mb-1.5">Package Pricing</p>
              <div className="space-y-1.5">
                {packages.map((p) =>
                  editingPackageId === p.id ? (
                    <div key={p.id} className="border border-pine/30 rounded-lg p-2 space-y-1.5 bg-pine/5">
                      <input
                        type="text"
                        placeholder="Label"
                        value={packageEditForm.label}
                        onChange={(e) => setPackageEditForm({ ...packageEditForm, label: e.target.value })}
                        className={inputClass()}
                      />
                      <input
                        type="text"
                        placeholder="Rate Label (e.g. 700 TK (Per Hour))"
                        value={packageEditForm.rate_label}
                        onChange={(e) => setPackageEditForm({ ...packageEditForm, rate_label: e.target.value })}
                        className={inputClass()}
                      />
                      <input
                        type="number"
                        placeholder="Hourly Rate (blank = WhatsApp-only package)"
                        value={packageEditForm.hourly_rate}
                        onChange={(e) => setPackageEditForm({ ...packageEditForm, hourly_rate: e.target.value })}
                        className={inputClass()}
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingPackageId(null)}
                          className="flex-1 border border-[#E0E0E0] rounded-lg py-1 text-[10px] font-medium text-[#333333]/60"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={packageSaving}
                          onClick={savePackageEdit}
                          className="flex-1 bg-pine text-white rounded-lg py-1 text-[10px] font-semibold disabled:opacity-50"
                        >
                          {packageSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={p.id} className="flex items-center justify-between gap-2 border border-[#E0E0E0]/70 rounded-lg px-2.5 py-1.5">
                      <span className="min-w-0">
                        <span className="text-xs font-semibold text-[#333333] block truncate">{p.label}</span>
                        <span className="text-[10px] text-[#333333]/50">{p.rate_label || 'WhatsApp only'}</span>
                      </span>
                      <button
                        onClick={() => startEditPackage(p)}
                        className="flex items-center gap-1 shrink-0 border border-[#E0E0E0] rounded-lg px-2 py-1 text-[10px] font-medium text-[#333333]/70"
                      >
                        <IconEdit className="h-3 w-3" /> Edit
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Opening hours */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#333333]/55 font-semibold mb-1.5">Opening Hours</p>
              <div className="grid grid-cols-2 gap-2.5 mb-2">
                <select
                  value={hoursForm.start}
                  onChange={(e) => setHoursForm({ ...hoursForm, start: e.target.value })}
                  className={inputClass()}
                >
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
                <select
                  value={hoursForm.end}
                  onChange={(e) => setHoursForm({ ...hoursForm, end: e.target.value })}
                  className={inputClass()}
                >
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>
              <button
                disabled={hoursSaving}
                onClick={saveHours}
                className="w-full bg-pine text-white rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {hoursSaving ? 'Saving…' : 'Save Opening Hours'}
              </button>
            </div>

            {/* Special off-days */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#333333]/55 font-semibold mb-1.5">Special Off-Days</p>
              <div className="border border-[#E0E0E0]/70 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1.5">
                  <button
                    type="button"
                    onClick={() => setOffDayMonth(addMonths(offDayMonth, -1))}
                    className="text-xs font-medium text-[#333333]/60 px-1.5"
                  >
                    ‹
                  </button>
                  <p className="text-xs font-semibold text-[#333333]">
                    {offDayMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOffDayMonth(addMonths(offDayMonth, 1))}
                    className="text-xs font-medium text-[#333333]/60 px-1.5"
                  >
                    ›
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {offDayMonthCells.map((d, i) => {
                    if (!d) return <div key={`blank-${i}`} />
                    const key = toDateKey(d)
                    const isOff = offDays.some((o) => o.off_date === key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleOffDay(key)}
                        className={`rounded-md py-1 text-[10px] font-semibold transition-all ${
                          isOff ? 'bg-clay text-white' : 'bg-[#F9F7F2] text-[#333333] hover:bg-mist/40'
                        }`}
                      >
                        {d.getDate()}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[9px] text-[#333333]/45 mt-1.5">Tap a date to mark the studio closed (or reopen it).</p>
              </div>
            </div>
          </div>
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#333333]/30 hover:text-[#333333]/60"
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
        <p className="text-xs text-[#333333]/40 py-6 text-center">Loading…</p>
      ) : isFiltering ? (
        <>
          <p className="text-sm font-semibold mb-2">Search Results ({searchResults.length})</p>
          {searchResults.length === 0 ? (
            <p className="flex flex-col items-center gap-2 text-xs text-[#333333]/40 py-8 text-center">
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
            {confirmedUpcoming.length === 0 && <p className="text-xs text-[#333333]/40">No bookings</p>}
            {confirmedUpcoming.map((b) => (
              <BookingRow key={b.id} {...bookingRowProps(b)} />
            ))}
          </ul>
        </>
      )}

      {paymentModalBooking && (
        <PaymentModal
          booking={paymentModalBooking}
          form={paymentForm}
          onChange={setPaymentForm}
          error={paymentError}
          saving={paymentSaving}
          onSave={handleAddPayment}
          onClose={() => setPaymentModalBooking(null)}
        />
      )}

      {historyModalBooking && (
        <HistoryModal
          booking={historyModalBooking}
          payments={payments}
          statusLogs={statusLogs}
          onClose={() => setHistoryModalBooking(null)}
        />
      )}
    </div>
  )
}
