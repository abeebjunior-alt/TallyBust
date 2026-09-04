-- =====================================================================
-- TallyBust — migration v9: refunds
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
-- =====================================================================

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,
  qty integer not null check (qty > 0),
  unit_price numeric(12,2) not null default 0,
  reason text,
  requested_by text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.refunds enable row level security;

drop policy if exists "refunds: owner read" on public.refunds;
create policy "refunds: owner read" on public.refunds
  for select using (auth.uid() = user_id);

drop policy if exists "refunds: owner insert" on public.refunds;
create policy "refunds: owner insert" on public.refunds
  for insert with check (auth.uid() = user_id);

drop policy if exists "refunds: owner update" on public.refunds;
create policy "refunds: owner update" on public.refunds
  for update using (auth.uid() = user_id);

create index if not exists refunds_user_idx on public.refunds(user_id);
create index if not exists refunds_status_idx on public.refunds(status);
