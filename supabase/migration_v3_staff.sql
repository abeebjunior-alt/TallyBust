-- =====================================================================
-- TallyBust — migration v3: staff accounts (name + PIN + role)
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
-- =====================================================================

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  pin text not null,
  role text not null default 'Cashier' check (role in ('Admin', 'Manager', 'Cashier', 'Storekeeper')),
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

drop policy if exists "staff: owner all" on public.staff;
create policy "staff: owner all" on public.staff
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists staff_user_idx on public.staff(user_id);

-- Note: the selfie-capture feature has been removed, so stock_history's
-- captured_photo column is no longer written to going forward. It's left
-- in place (harmless) rather than dropped, so any photos already saved
-- aren't deleted. Safe to ignore.
