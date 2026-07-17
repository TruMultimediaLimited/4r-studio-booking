-- ============================================================
-- 4R Studio booking schema — run in Supabase SQL Editor
--
-- Safe to run any time, including re-runs: it drops and recreates the
-- `bookings` table and `public_bookings` view from scratch first, so the
-- result is always fresh. This DELETES any existing booking rows —
-- only re-run it if that's what you want (e.g. resetting test data).
-- ============================================================

drop view if exists public.public_bookings;
drop table if exists public.bookings cascade;

-- Extensions
create extension if not exists pgcrypto;    -- gen_random_uuid()
create extension if not exists btree_gist;  -- lets EXCLUDE mix an equality column with a range

-- ---------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  booking_date  date not null,
  start_time    time not null,
  end_time      time not null,
  client_name   text,
  client_phone  text,
  package_name  text,
  status        text not null default 'confirmed' check (status in ('confirmed', 'pending', 'cancelled')),
  created_at    timestamptz not null default now(),

  constraint valid_time_order check (start_time < end_time),

  -- A public booking request must always include contact info so staff can follow up.
  constraint pending_requires_contact check (
    status <> 'pending' or (client_name is not null and client_phone is not null)
  ),

  -- Hard guarantee: no two non-cancelled bookings (confirmed OR pending) may overlap
  -- in time on the same date. A pending request temporarily holds the slot until
  -- staff confirms or rejects it. Cancelling a booking (status -> 'cancelled')
  -- removes it from this check entirely, freeing the slot for a new booking.
  constraint no_overlapping_bookings exclude using gist (
    booking_date with =,
    tsrange(booking_date + start_time, booking_date + end_time, '[)') with &&
  ) where (status <> 'cancelled')
);

comment on constraint no_overlapping_bookings on public.bookings is
  'Prevents overlapping time ranges on the same booking_date for non-cancelled (confirmed or pending) rows. Raises SQLSTATE 23P01 on violation.';

-- ---------------------------------------------------------------
-- Indexes (the GiST index above already covers the exclude check;
-- these speed up the app's actual read queries)
-- ---------------------------------------------------------------
create index bookings_date_idx on public.bookings (booking_date);
create index bookings_date_status_idx on public.bookings (booking_date, status);

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table public.bookings enable row level security;

-- Staff (any authenticated user) can read every row, including cancelled ones,
-- pending requests, and client/package names, for the admin list.
create policy "authenticated read all bookings"
  on public.bookings for select
  to authenticated
  using (true);

-- Staff can create new bookings.
create policy "authenticated insert bookings"
  on public.bookings for insert
  to authenticated
  with check (true);

-- Staff can update bookings (in practice only ever to flip status -> 'confirmed'
-- or 'cancelled'; see the column grant below, which is the actual enforcement of that).
create policy "authenticated update bookings"
  on public.bookings for update
  to authenticated
  using (true)
  with check (true);

-- No DELETE policy exists at all -> nobody can delete rows via the API, by anyone,
-- ever. Cancellation/rejection is the only removal path, and it's an UPDATE.

-- Anon needs to read non-cancelled rows too, but ONLY through the public_bookings
-- view below (security_invoker = true makes the view apply this exact policy).
create policy "anon read non-cancelled bookings"
  on public.bookings for select
  to anon
  using (status <> 'cancelled');

-- Anon (public website visitors) can submit a booking REQUEST, but it always
-- lands as 'pending' — never directly as 'confirmed'. Staff confirms/rejects
-- from the admin panel.
create policy "anon insert pending booking requests"
  on public.bookings for insert
  to anon
  with check (status = 'pending');

-- ---------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------
-- Staff: full column access for the operations the policies above allow.
grant select, insert on public.bookings to authenticated;
-- Staff can update status (confirm/cancel/reject) and edit an existing
-- booking's date/time/client/package details from the admin panel.
grant update (booking_date, start_time, end_time, client_name, client_phone, package_name, status)
  on public.bookings to authenticated;

-- Anon: only the columns the public page needs to read, nothing else.
grant select (id, booking_date, start_time, end_time, status) on public.bookings to anon;
-- Anon: only the columns needed to submit a booking request. No update/delete ever.
grant insert (booking_date, start_time, end_time, client_name, client_phone, package_name, status)
  on public.bookings to anon;

-- ---------------------------------------------------------------
-- Public view — the only thing the public page ever queries
-- ---------------------------------------------------------------
create view public.public_bookings
  with (security_invoker = true) as
  select id, booking_date, start_time, end_time, status
  from public.bookings
  where status <> 'cancelled';

grant select on public.public_bookings to anon;

-- ---------------------------------------------------------------
-- Client self-service lookup — "My Bookings" on the public page.
--
-- No client accounts/passwords: a visitor enters the phone number they
-- booked with and gets back just their own rows. client_phone is never
-- exposed to anon via SELECT (see grants above), so this has to go
-- through a SECURITY DEFINER function that filters strictly by an exact
-- phone match, rather than a broader RLS policy anon could query directly.
-- Matching compares only the last 10 digits (after stripping non-digits)
-- so "01712345678" and "+8801712345678" are treated as the same number,
-- regardless of which format was stored.
-- ---------------------------------------------------------------
create or replace function public.get_bookings_by_phone(p_phone text)
returns table (
  id            uuid,
  booking_date  date,
  start_time    time,
  end_time      time,
  package_name  text,
  status        text,
  created_at    timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, booking_date, start_time, end_time, package_name, status, created_at
  from public.bookings
  where right(regexp_replace(client_phone, '\D', '', 'g'), 10)
      = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
  order by booking_date desc, start_time desc;
$$;

grant execute on function public.get_bookings_by_phone(text) to anon;
