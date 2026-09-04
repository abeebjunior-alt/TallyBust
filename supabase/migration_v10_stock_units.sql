-- =====================================================================
-- TallyBust — migration v10: per-unit label tracking
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
--
-- Each printed label now encodes its own unique code (not just the
-- product SKU repeated). Scanning a code to Stock In flips it from
-- 'unstocked' to 'in_stock'. Scanning the same physical label again
-- is blocked with "already stocked" instead of silently double-counting.
-- =====================================================================

create table if not exists public.stock_units (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  status text not null default 'unstocked' check (status in ('unstocked', 'in_stock', 'sold')),
  created_at timestamptz not null default now(),
  stocked_in_at timestamptz,
  sold_at timestamptz
);

alter table public.stock_units enable row level security;

drop policy if exists "stock_units: owner read" on public.stock_units;
create policy "stock_units: owner read" on public.stock_units
  for select using (auth.uid() = user_id);

drop policy if exists "stock_units: owner insert" on public.stock_units;
create policy "stock_units: owner insert" on public.stock_units
  for insert with check (auth.uid() = user_id);

drop policy if exists "stock_units: owner update" on public.stock_units;
create policy "stock_units: owner update" on public.stock_units
  for update using (auth.uid() = user_id);

create index if not exists stock_units_product_idx on public.stock_units(product_id);
create index if not exists stock_units_status_idx on public.stock_units(status);
