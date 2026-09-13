-- =====================================================================
-- TallyBust — migration v12: Write Off approval workflow
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
--
-- Write Off used to happen the instant anyone scanned an item — it left
-- stock and hit the books immediately, no matter who scanned it. This
-- migration makes Write Off work the same way Refunds already do:
--
--   1. Scanning Write Off locks that exact unit (status becomes
--      'pending_write_off') so it can't be sold, refunded, or written
--      off again, and files a row in the new write_offs table.
--   2. The item is still counted in stock and Inventory Value while
--      pending — nothing has actually been lost yet.
--   3. Only an Admin, from the Stock Health tab, can confirm it. That's
--      the moment qty actually drops and the loss is logged to
--      stock_history (so it hits the Write-Off Log and Reports).
--   4. Rejecting it puts the unit back to in_stock, untouched.
-- =====================================================================

alter table public.product_units drop constraint if exists product_units_status_check;
alter table public.product_units add constraint product_units_status_check
  check (status in ('unstocked', 'in_stock', 'opened', 'sold', 'written_off', 'pending_write_off'));

create table if not exists public.write_offs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,
  qty integer not null default 1 check (qty > 0),
  -- The exact physical item this write-off is for (product_units.code).
  unit_code text,
  -- What this unit actually cost, captured when the request was filed —
  -- so the loss logged on approval reflects what was really paid, not
  -- today's price if it's changed since.
  purchase_price numeric,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  staff text not null default 'Admin',
  requested_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz
);

alter table public.write_offs enable row level security;

drop policy if exists "write_offs: owner all" on public.write_offs;
create policy "write_offs: owner all" on public.write_offs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "write_offs: staff all" on public.write_offs;
create policy "write_offs: staff all" on public.write_offs
  for all using (public.is_staff_of(user_id)) with check (public.is_staff_of(user_id));

create index if not exists write_offs_user_idx on public.write_offs(user_id);
create index if not exists write_offs_status_idx on public.write_offs(status);

notify pgrst, 'reload schema';
