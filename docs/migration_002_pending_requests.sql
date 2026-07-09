-- ============================================================
-- Only run this if you already ran an EARLIER version of docs/schema.sql
-- (i.e. the `bookings` table already exists) and just need to add
-- support for customer-submitted booking requests.
--
-- If you have NOT set up the database yet, do not run this file —
-- just run docs/schema.sql instead, it already includes everything below.
-- ============================================================

alter table public.bookings add column if not exists client_phone text;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('confirmed', 'pending', 'cancelled'));

alter table public.bookings drop constraint if exists pending_requires_contact;
alter table public.bookings add constraint pending_requires_contact check (
  status <> 'pending' or (client_name is not null and client_phone is not null)
);

drop policy if exists "anon insert pending booking requests" on public.bookings;
create policy "anon insert pending booking requests"
  on public.bookings for insert
  to anon
  with check (status = 'pending');

grant insert (booking_date, start_time, end_time, client_name, client_phone, package_name, status)
  on public.bookings to anon;
