# 4R Studio — Booking

স্টুডিও কখন খালি/বুকড তা দেখার একটা পাবলিক পেজ, আর টিমের জন্য বুকিং যোগ/বাতিল করার একটা এডমিন পেজ।
A public "is the studio free right now?" page, plus a simple staff page to add/cancel bookings.

- পাবলিক পেজ (ক্লায়েন্টদের জন্য): `/`
- টিম পেজ (স্টাফদের জন্য): `/#/admin`

## Local dev

1. `npm install`
2. `.env.example` কপি করে `.env.local` বানান, আপনার Supabase প্রজেক্টের URL ও anon key বসান।
3. `npm run dev`

## Database setup (একবারই করতে হবে)

Supabase Dashboard → SQL Editor-এ গিয়ে `docs/schema.sql` ফাইলের পুরো কনটেন্ট পেস্ট করে রান করুন। এটা তৈরি করবে:
- `bookings` টেবিল
- একই সময়ে দুটো বুকিং ওভারল্যাপ হতে না দেওয়ার ডাটাবেজ-লেভেল গ্যারান্টি
- RLS পলিসি (পাবলিক শুধু ফাঁকা/বুকড দেখতে পারবে, ক্লায়েন্টের নাম দেখতে পারবে না; শুধু লগইন করা স্টাফ বুকিং যোগ/বাতিল করতে পারবে)
- `public_bookings` ভিউ, যেটা পাবলিক পেজ ব্যবহার করে

## প্রথম স্টাফ লগইন তৈরি

Supabase Dashboard → Authentication → Users → Add user → ইমেইল ও পাসওয়ার্ড দিন (Auto Confirm User অন রাখুন)। প্রতিটা টিম মেম্বারের জন্য আলাদা করে বানাতে পারেন।

## Deploy to Vercel

1. এই GitHub রিপো Vercel-এ Import করুন (Vite অটো-ডিটেক্ট হবে, `vercel.json` লাগবে না)।
2. Vercel Project Settings → Environment Variables-এ `VITE_SUPABASE_URL` আর `VITE_SUPABASE_ANON_KEY` যোগ করুন (`.env.local`-এর মতোই ভ্যালু)।
3. Deploy করুন। পাবলিক লিংক ক্লায়েন্টদের সাথে শেয়ার করুন, `/#/admin` স্টাফদের জন্য।

## এখন কী আছে, পরে কী আসবে

এখন শুধু: এক জায়গায় দেখা যাবে স্টুডিও কখন খালি, ওভারল্যাপ হওয়া সম্ভবই না, বার বার কল দেওয়া লাগবে না।
পরে যোগ হবে (এই ভার্সনে নেই): প্যাকেজ সিলেকশন, অ্যাডভান্স পেমেন্ট, ক্লায়েন্ট নিজে বুকিং রিকোয়েস্ট পাঠানো।
