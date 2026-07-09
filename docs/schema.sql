-- ============================================================
-- 4R Studio booking schema — run once in Supabase SQL Editor
-- ============================================================

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
  package_name  text,
  status        text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at    timestamptz not null default now(),

  constraint valid_time_order check (start_time < end_time),

  -- Hard guarantee: no two non-cancelled bookings may overlap in time on the same date.
  -- Cancelling a booking (status -> 'cancelled') removes it from this check entirely,
  -- freeing the slot for a new booking.
  constraint no_overlapping_bookings exclude using gist (
    booking_date with =,
    tsrange(booking_date + start_time, booking_date + end_time, '[)') with &&
  ) where (status <> 'cancelled')
);

comment on constraint no_overlapping_bookings on public.bookings is
  'Prevents overlapping time ranges on the same booking_date for non-cancelled rows. Raises SQLSTATE 23P01 on violation.';

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

-- Staff (any authenticated user) can read every row, including cancelled ones
-- and client/package names, for the admin list.
create policy "authenticated read all bookings"
  on public.bookings for select
  to authenticated
  using (true);

-- Staff can create new bookings.
create policy "authenticated insert bookings"
  on public.bookings for insert
  to authenticated
  with check (true);

-- Staff can update bookings (in practice only ever to flip status -> 'cancelled';
-- see the column grant below, which is the actual enforcement of that).
create policy "authenticated update bookings"
  on public.bookings for update
  to authenticated
  using (true)
  with check (true);

-- No DELETE policy exists at all -> nobody can delete rows via the API, by anyone,
-- ever. Cancellation is the only removal path, and it's an UPDATE.

-- Anon needs to read non-cancelled rows too, but ONLY through the public_bookings
-- view below (security_invoker = true makes the view apply this exact policy).
create policy "anon read non-cancelled bookings"
  on public.bookings for select
  to anon
  using (status <> 'cancelled');

-- ---------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------
-- Staff: full column access for the operations the policies above allow.
grant select, insert on public.bookings to authenticated;
-- Staff may only ever UPDATE the status column (i.e. cancel). They cannot rewrite
-- an existing booking's date/time/client/package through the API.
grant update (status) on public.bookings to authenticated;

-- Anon: only the columns the public page needs, nothing else. No insert/update/delete.
grant select (id, booking_date, start_time, end_time, status) on public.bookings to anon;

-- ---------------------------------------------------------------
-- Public view — the only thing the public page ever queries
-- ---------------------------------------------------------------
create view public.public_bookings
  with (security_invoker = true) as
  select id, booking_date, start_time, end_time, status
  from public.bookings
  where status <> 'cancelled';

grant select on public.public_bookings to anon;
