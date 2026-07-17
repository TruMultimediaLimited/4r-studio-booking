import { timingSafeEqual } from 'node:crypto'

// Vercel Serverless Function. Receives a Supabase Database Webhook call on
// INSERT into `bookings` and relays it to Telegram, since the webhook's
// fixed payload shape ({type, table, record, ...}) can't be pointed
// directly at Telegram's Bot API.

function secretMatches(given, expected) {
  if (typeof given !== 'string' || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!secretMatches(req.headers['x-webhook-secret'], process.env.WEBHOOK_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const record = req.body?.record
  if (!record || record.status !== 'pending') {
    res.status(200).json({ skipped: true })
    return
  }

  const text = [
    '🔔 নতুন বুকিং রিকোয়েস্ট!',
    '',
    `তারিখ: ${record.booking_date}`,
    `সময়: ${record.start_time?.slice(0, 5)} – ${record.end_time?.slice(0, 5)}`,
    `নাম: ${record.client_name || '—'}`,
    `ফোন: ${record.client_phone || '—'}`,
    `প্যাকেজ: ${record.package_name || 'উল্লেখ নেই'}`,
    '',
    'এডমিন প্যানেলে গিয়ে কনফার্ম/প্রত্যাখ্যান করুন।',
  ].join('\n')

  try {
    const telegramRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
      }
    )

    if (!telegramRes.ok) {
      const body = await telegramRes.text()
      res.status(502).json({ error: 'Telegram send failed', body })
      return
    }
  } catch (err) {
    res.status(502).json({ error: 'Telegram send failed', body: String(err) })
    return
  }

  res.status(200).json({ sent: true })
}
