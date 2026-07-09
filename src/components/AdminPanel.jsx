import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { timeToMinutes, overlaps } from '../lib/time.js'

export default function AdminPanel() {
  const [session, setSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const [bookings, setBookings] = useState([])
  const [form, setForm] = useState({
    booking_date: '',
    start_time: '',
    end_time: '',
    client_name: '',
    client_phone: '',
    package_name: '',
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

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
    loadUpcomingBookings()
  }, [session])

  async function loadUpcomingBookings() {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .gte('booking_date', today)
      .neq('status', 'cancelled')
      .order('booking_date')
      .order('start_time')
    setBookings(data || [])
  }

  const pendingBookings = bookings.filter((b) => b.status === 'pending')
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed')

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

    // Client-side overlap check against already-loaded bookings for same date
    const clash = bookings.find(
      (b) =>
        b.booking_date === form.booking_date &&
        overlaps(form.start_time, form.end_time, b.start_time, b.end_time)
    )
    if (clash) {
      setFormError(`এই সময় ইতিমধ্যে বুকড (${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)})`)
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
      // Unique constraint from DB (in case of race between two team members)
      if (error.code === '23P01' || error.message?.includes('overlap')) {
        setFormError('এই সময় ইতিমধ্যে অন্য কেউ বুক করে ফেলেছে। রিফ্রেশ করে আবার চেষ্টা করুন।')
      } else {
        setFormError('সেভ করা যায়নি: ' + error.message)
      }
      return
    }

    setForm((f) => ({
      ...f,
      booking_date: '',
      start_time: '',
      end_time: '',
      client_name: '',
      client_phone: '',
      package_name: '',
    }))
    loadUpcomingBookings()
  }

  async function handleCancel(id) {
    if (!confirm('এই বুকিং বাতিল করবেন?')) return
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    loadUpcomingBookings()
  }

  async function handleConfirm(id) {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id)
    loadUpcomingBookings()
  }

  async function handleReject(id) {
    if (!confirm('এই রিকোয়েস্ট প্রত্যাখ্যান করবেন?')) return
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    loadUpcomingBookings()
  }

  if (!authChecked) {
    return <p className="text-sm text-ink/40 py-12 text-center">লোড হচ্ছে…</p>
  }

  if (!session) {
    return (
      <form onSubmit={handleLogin} className="max-w-sm mx-auto mt-12 bg-white border border-mist rounded-2xl p-6">
        <p className="font-display text-xl mb-1">টিম লগইন</p>
        <p className="text-sm text-ink/50 mb-4">বুকিং যোগ/বাতিল করতে লগইন করুন</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ইমেইল"
          className="w-full border border-mist rounded-lg px-3 py-2 mb-3 outline-none focus:border-pine"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="পাসওয়ার্ড"
          className="w-full border border-mist rounded-lg px-3 py-2 mb-3 outline-none focus:border-pine"
        />
        {loginError && <p className="text-sm text-clay mb-3">{loginError}</p>}
        <button disabled={loggingIn} className="w-full bg-pine text-paper rounded-lg py-2 font-medium disabled:opacity-50">
          {loggingIn ? 'ঢুকছে…' : 'ঢুকুন'}
        </button>
      </form>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={handleLogout} className="text-xs text-ink/50 hover:text-clay">
          লগআউট
        </button>
      </div>

      <form onSubmit={handleAddBooking} className="bg-white border border-mist rounded-2xl p-4 mb-6">
        <p className="font-display text-lg mb-3">নতুন বুকিং যোগ করুন</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            type="date"
            value={form.booking_date}
            onChange={(e) => setForm({ ...form, booking_date: e.target.value })}
            className="col-span-2 border border-mist rounded-lg px-3 py-2"
          />

          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            className="border border-mist rounded-lg px-3 py-2"
          />
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            className="border border-mist rounded-lg px-3 py-2"
          />

          <input
            type="text"
            placeholder="ক্লায়েন্টের নাম (ঐচ্ছিক)"
            value={form.client_name}
            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            className="col-span-2 border border-mist rounded-lg px-3 py-2"
          />

          <input
            type="tel"
            placeholder="ফোন নম্বর (ঐচ্ছিক)"
            value={form.client_phone}
            onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
            className="col-span-2 border border-mist rounded-lg px-3 py-2"
          />

          <input
            type="text"
            placeholder="প্যাকেজ (ঐচ্ছিক)"
            value={form.package_name}
            onChange={(e) => setForm({ ...form, package_name: e.target.value })}
            className="col-span-2 border border-mist rounded-lg px-3 py-2"
          />
        </div>

        {formError && (
          <p className="text-sm text-clay bg-clay/10 border border-clay/20 rounded-lg px-3 py-2 mb-3">
            {formError}
          </p>
        )}

        <button disabled={saving} className="w-full bg-pine text-paper rounded-lg py-2 font-medium disabled:opacity-50">
          {saving ? 'সেভ হচ্ছে…' : 'বুকিং কনফার্ম করুন'}
        </button>
      </form>

      {pendingBookings.length > 0 && (
        <>
          <p className="font-display text-lg mb-3">বুকিং রিকোয়েস্ট (অপেক্ষমান)</p>
          <ul className="space-y-2 mb-6">
            {pendingBookings.map((b) => (
              <li
                key={b.id}
                className="bg-white border border-clay/30 rounded-xl px-3 py-2.5 text-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium">
                      {b.booking_date}
                      {b.package_name ? ` — ${b.package_name}` : ''}
                    </p>
                    <p className="text-ink/50 text-xs">
                      {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                      {b.client_name ? ` · ${b.client_name}` : ''}
                      {b.client_phone ? ` · ${b.client_phone}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(b.id)}
                    className="flex-1 border border-mist rounded-lg py-1.5 text-xs font-medium text-ink/60"
                  >
                    প্রত্যাখ্যান
                  </button>
                  <button
                    onClick={() => handleConfirm(b.id)}
                    className="flex-1 bg-pine text-paper rounded-lg py-1.5 text-xs font-medium"
                  >
                    কনফার্ম করুন
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="font-display text-lg mb-3">আসন্ন বুকিং</p>
      <ul className="space-y-2">
        {confirmedBookings.length === 0 && <p className="text-sm text-ink/40">কোনো বুকিং নেই</p>}
        {confirmedBookings.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between bg-white border border-mist rounded-xl px-3 py-2.5 text-sm"
          >
            <div>
              <p className="font-medium">
                {b.booking_date}
                {b.package_name ? ` — ${b.package_name}` : ''}
              </p>
              <p className="text-ink/50 text-xs">
                {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                {b.client_name ? ` · ${b.client_name}` : ''}
                {b.client_phone ? ` · ${b.client_phone}` : ''}
              </p>
            </div>
            <button onClick={() => handleCancel(b.id)} className="text-clay text-xs font-medium">
              বাতিল
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
