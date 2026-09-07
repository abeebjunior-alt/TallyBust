-- =====================================================================
-- TallyBust — migration: refunds
-- Run this once in Supabase's SQL Editor (Dashboard → SQL Editor → New
-- query → paste all of this → Run). Safe to run on your existing
-- database — it only adds new things, it doesn't touch your data.
-- =====================================================================

-- 1. Allow 'refund' as a stock_history transaction type --------------------
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.stock_history'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%stock-in%';
  if con_name is not null then
    execute format('alter table public.stock_history drop constraint %I', con_name);
  end if;
end $$;

alter table public.stock_history
  add constraint stock_history_type_check check (type in ('stock-in', 'sale', 'count', 'refund'));

-- 2. Refunds table: pending → approved / rejected ---------------------------
-- A refund starts as "pending" and does NOT touch stock or inventory value
-- until it's approved. Only once approved does it add the quantity back
-- to the product and log a 'refund' row in stock_history.
create table if not exists public.refunds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,
  qty integer not null check (qty > 0),
  unit_price numeric(12,2) not null default 0,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by text not null default 'Admin',
  approved_by text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz
);

alter table public.refunds enable row level security;

create policy "refunds: owner read" on public.refunds
  for select using (auth.uid() = user_id);
create policy "refunds: owner insert" on public.refunds
  for insert with check (auth.uid() = user_id);
create policy "refunds: owner update" on public.refunds
  for update using (auth.uid() = user_id);

create index if not exists refunds_user_idx on public.refunds(user_id);
create index if not exists refunds_product_idx on public.refunds(product_id);
create index if not exists refunds_status_idx on public.refunds(status);
