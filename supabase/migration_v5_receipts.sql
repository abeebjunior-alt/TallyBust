-- =====================================================================
-- TallyBust — migration v5: payment receipts
-- Businesses attach a receipt after paying; admin reviews it on the
-- Admin Dashboard and activates the subscription once verified.
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
-- =====================================================================

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image text not null, -- compressed JPEG as a base64 data URL
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.payment_receipts enable row level security;

drop policy if exists "receipts: owner insert" on public.payment_receipts;
create policy "receipts: owner insert" on public.payment_receipts
  for insert with check (auth.uid() = user_id);

drop policy if exists "receipts: owner read own" on public.payment_receipts;
create policy "receipts: owner read own" on public.payment_receipts
  for select using (auth.uid() = user_id);

drop policy if exists "receipts: admin read all" on public.payment_receipts;
create policy "receipts: admin read all" on public.payment_receipts
  for select using (public.is_admin());

drop policy if exists "receipts: admin update" on public.payment_receipts;
create policy "receipts: admin update" on public.payment_receipts
  for update using (public.is_admin());

create index if not exists receipts_user_idx on public.payment_receipts(user_id);
