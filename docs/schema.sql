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

-- Staff may permanently delete a booking, but ONLY once it's already
-- cancelled — this lets staff clear out test/junk rows from the admin
-- panel without ever being able to destroy an active pending/confirmed
-- booking by mistake. Cancelling (an UPDATE) is always required first.
create policy "authenticated delete cancelled bookings"
  on public.bookings for delete
  to authenticated
  using (status = 'cancelled');

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
-- Staff can permanently delete a booking; the DELETE policy above still
-- restricts this to rows that are already status = 'cancelled'.
grant delete on public.bookings to authenticated;

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

-- ============================================================
-- Admin management-system migration (Follow-up 34)
--
-- Unlike the reset script above, everything below is ADDITIVE and safe
-- to run once against the live database — it does not touch existing
-- `bookings` rows and uses IF NOT EXISTS guards throughout. Run this
-- whole block in the Supabase SQL Editor once.
-- ============================================================

-- ---------------------------------------------------------------
-- bookings: numeric total + link to a package row (both nullable —
-- older/staff-entered rows may not have either; package_name stays as
-- the free-text historical snapshot shown on the row regardless).
-- ---------------------------------------------------------------
alter table public.bookings add column if not exists total_amount numeric;

-- ---------------------------------------------------------------
-- packages — replaces the hardcoded array in src/lib/packages.js so
-- price/name changes take effect immediately without a redeploy.
-- ---------------------------------------------------------------
create table if not exists public.packages (
  id           text primary key,
  label        text not null,
  rate_label   text,
  hourly_rate  numeric,
  sort_order   int not null default 0,
  is_active    boolean not null default true
);

insert into public.packages (id, label, rate_label, hourly_rate, sort_order) values
  ('photoshoot', 'Studio Rent for Photoshoot', '700 TK (Per Hour)', 700, 1),
  ('photo_video', 'Studio Rent for Photo & Videoshoot', '1000 TK (Per Hour)', 1000, 2),
  ('custom', 'Others', null, null, 3)
on conflict (id) do nothing;

alter table public.bookings add column if not exists package_id text references public.packages(id);

alter table public.packages enable row level security;

create policy "anon read active packages" on public.packages for select to anon using (is_active = true);
create policy "authenticated read all packages" on public.packages for select to authenticated using (true);
create policy "authenticated manage packages" on public.packages for all to authenticated using (true) with check (true);

grant select on public.packages to anon;
grant select, insert, update, delete on public.packages to authenticated;

-- Public booking requests now also carry total_amount/package_id.
grant insert (total_amount, package_id) on public.bookings to anon;
grant update (total_amount, package_id) on public.bookings to authenticated;

-- ---------------------------------------------------------------
-- studio_settings — a single-row table (id forced to `true`) holding
-- business hours. Replaces the hardcoded BUSINESS_START_HOUR/
-- BUSINESS_END_HOUR constants; the public page and admin panel both
-- read this at runtime.
-- ---------------------------------------------------------------
create table if not exists public.studio_settings (
  id                    boolean primary key default true check (id),
  business_start_hour   int not null default 9,
  business_end_hour     int not null default 23
);

insert into public.studio_settings (id) values (true) on conflict (id) do nothing;

alter table public.studio_settings enable row level security;

create policy "anon read settings" on public.studio_settings for select to anon using (true);
create policy "authenticated read settings" on public.studio_settings for select to authenticated using (true);
create policy "authenticated update settings" on public.studio_settings for update to authenticated using (true) with check (true);

grant select on public.studio_settings to anon;
grant select, update on public.studio_settings to authenticated;

-- ---------------------------------------------------------------
-- off_days — specific dates the studio is closed. The public calendar
-- treats these like past dates (not selectable/bookable).
-- ---------------------------------------------------------------
create table if not exists public.off_days (
  off_date    date primary key,
  reason      text,
  created_at  timestamptz not null default now()
);

alter table public.off_days enable row level security;

create policy "anon read off days" on public.off_days for select to anon using (true);
create policy "authenticated read off days" on public.off_days for select to authenticated using (true);
create policy "authenticated manage off days" on public.off_days for all to authenticated using (true) with check (true);

grant select on public.off_days to anon;
grant select, insert, delete on public.off_days to authenticated;

-- ---------------------------------------------------------------
-- payments — an append-only ledger. Multiple partial payments can be
-- recorded against one booking; Due Amount is always computed as
-- bookings.total_amount minus the sum of this table's rows for that
-- booking (never stored redundantly, so it can't drift out of sync).
-- No update/delete policy on purpose — corrections are new entries, not
-- edits, which keeps the audit trail honest.
-- ---------------------------------------------------------------
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  amount       numeric not null check (amount > 0),
  method       text not null check (method in ('hand cash', 'bkash', 'nagad', 'bank')),
  collector    text not null check (collector in ('Rezwan', 'Radone', 'Rasel', 'Kabbo')),
  created_by   text,
  created_at   timestamptz not null default now()
);

create index if not exists payments_booking_idx on public.payments (booking_id);

alter table public.payments enable row level security;

create policy "authenticated read payments" on public.payments for select to authenticated using (true);
create policy "authenticated insert payments" on public.payments for insert to authenticated with check (true);

grant select, insert on public.payments to authenticated;

-- ---------------------------------------------------------------
-- Migration (Follow-up 38): payment methods changed from
-- Cash/bKash/Bank to Hand Cash/Bkash/Nagad/Bank. Only needed if the
-- `payments` table above already exists on the live database with the
-- old constraint — safe to run once, no data loss (assumes no existing
-- rows use the removed 'cash' value; there was no confirmed real
-- payment data at the time this was added).
-- ---------------------------------------------------------------
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('hand cash', 'bkash', 'nagad', 'bank'));

-- ---------------------------------------------------------------
-- booking_status_log — append-only audit trail of status transitions
-- (pending -> confirmed, confirmed -> cancelled, etc.), who did it and
-- when. `changed_by` is the staff member's email, captured client-side
-- from the authenticated session at the moment of the action.
-- ---------------------------------------------------------------
create table if not exists public.booking_status_log (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  changed_by   text,
  changed_at   timestamptz not null default now()
);

create index if not exists booking_status_log_booking_idx on public.booking_status_log (booking_id);

alter table public.booking_status_log enable row level security;

create policy "authenticated read status log" on public.booking_status_log for select to authenticated using (true);
create policy "authenticated insert status log" on public.booking_status_log for insert to authenticated with check (true);

grant select, insert on public.booking_status_log to authenticated;

-- ============================================================
-- Security-hardening migration (Follow-up: site audit)
--
-- ADDITIVE and safe to run once on the live database. Everything the
-- public booking form used to enforce only in the browser is now also
-- enforced here, because anyone can call the Supabase REST API directly
-- with the anon key and skip the React validation entirely.
-- ============================================================

-- The client no longer sends total_amount; the trigger below computes it
-- from the package's hourly rate so a malicious client can't set its own
-- price (e.g. an 8-hour booking with total_amount = 1).
revoke insert (total_amount) on public.bookings from anon;

-- Validates every public (pending) booking request server-side. Staff
-- rows (status 'confirmed') are trusted and skipped, so the admin panel
-- keeps full flexibility (backfilling past dates, off-day shoots, etc.).
create or replace function public.validate_public_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_now_time time := (now() at time zone 'Asia/Dhaka')::time;
  v_start_hour int;
  v_end_hour int;
  v_rate numeric;
  v_count int;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  -- Normalize + validate phone (same rule as the client: BD mobile,
  -- optional +880/880 country code instead of the leading 0).
  new.client_phone := regexp_replace(coalesce(new.client_phone, ''), '[\s-]', '', 'g');
  if new.client_phone !~ '^(\+?880|0)1[3-9][0-9]{8}$' then
    raise exception 'Please enter a valid Bangladeshi phone number';
  end if;

  new.client_name := btrim(coalesce(new.client_name, ''));
  if char_length(new.client_name) < 2 or char_length(new.client_name) > 100 then
    raise exception 'Please enter a valid name';
  end if;
  if new.package_name is not null and char_length(new.package_name) > 200 then
    raise exception 'Invalid package';
  end if;

  -- Date sanity: today through one year ahead, Bangladesh time.
  if new.booking_date < v_today or new.booking_date > v_today + 365 then
    raise exception 'Invalid booking date';
  end if;
  if new.booking_date = v_today and new.start_time <= v_now_time then
    raise exception 'This time has already passed';
  end if;

  -- Off-days are not bookable by the public.
  if exists (select 1 from public.off_days d where d.off_date = new.booking_date) then
    raise exception 'The studio is closed on this date';
  end if;

  -- Must fall within opening hours.
  select business_start_hour, business_end_hour
    into v_start_hour, v_end_hour
    from public.studio_settings limit 1;
  if found and (
       new.start_time < make_time(v_start_hour, 0, 0)
       or new.end_time > make_time(v_end_hour, 0, 0)
     ) then
    raise exception 'Outside opening hours';
  end if;

  -- Abuse limits: pending requests hold their slot (the exclusion
  -- constraint blocks overlaps), so without a cap one person could
  -- "reserve" the whole calendar with fake requests.
  select count(*) into v_count
    from public.bookings b
    where b.status = 'pending'
      and right(regexp_replace(b.client_phone, '\D', '', 'g'), 10)
        = right(regexp_replace(new.client_phone, '\D', '', 'g'), 10);
  if v_count >= 3 then
    raise exception 'You already have pending requests — please wait for confirmation or contact us on WhatsApp';
  end if;

  select count(*) into v_count
    from public.bookings b
    where b.status = 'pending'
      and b.created_at > now() - interval '1 hour';
  if v_count >= 20 then
    raise exception 'Too many requests right now, please try again in a little while';
  end if;

  -- Server-side price: computed from the package's live hourly rate,
  -- never taken from the client.
  new.total_amount := null;
  if new.package_id is not null then
    select hourly_rate into v_rate
      from public.packages
      where id = new.package_id and is_active;
    if v_rate is not null then
      new.total_amount := round(v_rate * (extract(epoch from (new.end_time - new.start_time)) / 3600.0));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_public_booking_trg on public.bookings;
create trigger validate_public_booking_trg
  before insert on public.bookings
  for each row execute function public.validate_public_booking();

-- ============================================================
-- Portfolio migration (Follow-up: portfolio gallery feature)
--
-- ADDITIVE and safe to run once on the live database. Adds a public
-- image gallery (Photoshoot/Event/Portrait/Product work samples) with
-- a Supabase Storage bucket for the actual image files and a table for
-- title/category/ordering metadata. Anyone can view; only logged-in
-- staff can upload or delete.
-- ============================================================

create table if not exists public.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  title         text,
  category      text not null default 'Photoshoot',
  storage_path  text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists portfolio_items_category_idx on public.portfolio_items (category);

alter table public.portfolio_items enable row level security;

create policy "anon read portfolio items" on public.portfolio_items for select to anon using (true);
create policy "authenticated read portfolio items" on public.portfolio_items for select to authenticated using (true);
create policy "authenticated manage portfolio items" on public.portfolio_items for all to authenticated using (true) with check (true);

grant select on public.portfolio_items to anon;
grant select, insert, update, delete on public.portfolio_items to authenticated;

-- Storage bucket for the actual image files. Public bucket (anyone can
-- view an image URL directly), but writes are gated by the policies
-- below to logged-in staff only.
insert into storage.buckets (id, name, public)
  values ('portfolio', 'portfolio', true)
  on conflict (id) do nothing;

drop policy if exists "public read portfolio images" on storage.objects;
create policy "public read portfolio images"
  on storage.objects for select
  using (bucket_id = 'portfolio');

drop policy if exists "authenticated upload portfolio images" on storage.objects;
create policy "authenticated upload portfolio images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio');

drop policy if exists "authenticated delete portfolio images" on storage.objects;
create policy "authenticated delete portfolio images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'portfolio');

-- ============================================================
-- Portfolio albums migration (Follow-up: album-based gallery redesign)
--
-- ADDITIVE and safe to run once on the live database. Replaces the flat
-- category filter with proper named albums/folders (each with an
-- optional cover photo). The old `category` column on portfolio_items
-- is left in place untouched — just no longer used by the UI — since
-- migrations here never drop columns or data.
-- ============================================================

create table if not exists public.portfolio_albums (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  cover_storage_path  text,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now()
);

alter table public.portfolio_albums enable row level security;

create policy "anon read portfolio albums" on public.portfolio_albums for select to anon using (true);
create policy "authenticated read portfolio albums" on public.portfolio_albums for select to authenticated using (true);
create policy "authenticated manage portfolio albums" on public.portfolio_albums for all to authenticated using (true) with check (true);

grant select on public.portfolio_albums to anon;
grant select, insert, update, delete on public.portfolio_albums to authenticated;

alter table public.portfolio_items
  add column if not exists album_id uuid references public.portfolio_albums(id) on delete cascade;

create index if not exists portfolio_items_album_idx on public.portfolio_items (album_id);

-- ============================================================
-- Package inclusions migration (Follow-up: "what's included" list)
--
-- ADDITIVE and safe to run once on the live database. Lets each
-- package show its own list of what's included (equipment, amenities,
-- etc.) on the public booking page. One item per line, edited from the
-- admin panel's Package Pricing section. Existing RLS/grants on
-- `packages` already cover this new column — nothing else to add.
-- ============================================================

alter table public.packages add column if not exists inclusions text;
