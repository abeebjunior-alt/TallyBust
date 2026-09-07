-- =====================================================================
-- TallyBust — migration v7: refunds (replaces Stock Count)
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
--
-- Stock Count has been removed from the app and replaced with Refund.
-- A refund is logged separately from the stock ledger and does NOT
-- change products.qty on its own — an Admin has to review it in the
-- app first. Accepting a refund adds the quantity back to the product
-- and writes a matching 'refund' row to stock_history; rejecting it
-- just closes the request with nothing added back to stock.
-- =====================================================================

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,
  qty integer not null check (qty > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  staff text not null default 'Admin',
  requested_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz
);

alter table public.refunds enable row level security;

drop policy if exists "refunds: owner all" on public.refunds;
create policy "refunds: owner all" on public.refunds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists refunds_user_idx on public.refunds(user_id);
create index if not exists refunds_status_idx on public.refunds(status);

-- Allow 'refund' as its own stock_history event type. 'count' is left in
-- place (not dropped) so any Stock Count rows you already have stay
-- valid — the app just no longer writes that type going forward.
alter table public.stock_history drop constraint if exists stock_history_type_check;
alter table public.stock_history add constraint stock_history_type_check
  check (type in ('stock-in', 'sale', 'count', 'unit-sale', 'refund'));
