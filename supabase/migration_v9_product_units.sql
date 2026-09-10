-- =====================================================================
-- TallyBust — migration v9: one unique code per physical item
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
--
-- Until now, every label printed for a product encoded the SAME product
-- SKU — scanning it just identified "this is Paracetamol" and you typed
-- how many. From now on, each physical item gets its OWN unique code.
-- Scanning one always means exactly one item — no quantity to type —
-- and that exact code can't be reused (a sold item can't be "sold"
-- again, an unstocked one can't be stocked in twice).
-- =====================================================================

create table if not exists public.product_units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null unique,
  -- unstocked: printed/generated but not yet scanned in
  -- in_stock:  scanned in via Stock In, available to sell
  -- sold:      scanned out via Stock Out, with a customer
  status text not null default 'unstocked' check (status in ('unstocked', 'in_stock', 'sold')),
  created_at timestamptz not null default now(),
  stocked_in_at timestamptz,
  sold_at timestamptz
);

alter table public.product_units enable row level security;

create policy "product_units: owner all" on public.product_units
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "product_units: admin read all" on public.product_units
  for select using (public.is_admin());
create policy "product_units: staff read" on public.product_units
  for select using (public.is_staff_of(user_id));
create policy "product_units: staff insert" on public.product_units
  for insert with check (public.is_staff_of(user_id));
create policy "product_units: staff update" on public.product_units
  for update using (public.is_staff_of(user_id));

create index if not exists product_units_user_idx on public.product_units(user_id);
create index if not exists product_units_product_idx on public.product_units(product_id);
create index if not exists product_units_status_idx on public.product_units(status);

-- Records exactly which physical item a refund request was for, so
-- approving it can flip that one item back to "in_stock" (not just
-- increment a number).
alter table public.refunds add column if not exists unit_code text;
