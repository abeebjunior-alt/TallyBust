-- =====================================================================
-- TallyBust — Supabase schema
-- Run this once in your project's SQL Editor (Supabase Dashboard →
-- SQL Editor → New query → paste all of this → Run).
--
-- Model: single business per authenticated user. Every row is owned by
-- the auth.uid() of the account that created it, and Row Level Security
-- makes sure a user can only ever see/change their own rows. This is
-- enough for a solo owner + shared staff logins; if you later want
-- separate staff logins with shared access to one business's data,
-- see the "multi-user business" note at the bottom.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- settings: one row per user — business name, currency
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'My Business',
  currency text not null default '₦',
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "settings: owner read" on public.settings
  for select using (auth.uid() = user_id);
create policy "settings: owner insert" on public.settings
  for insert with check (auth.uid() = user_id);
create policy "settings: owner update" on public.settings
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Uncategorized',
  sku text not null,
  qty integer not null default 0,
  min_stock integer not null default 0,
  purchase_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  supplier text,
  expiry date,
  batch text,
  created_at timestamptz not null default now(),
  unique (user_id, sku)
);

alter table public.products enable row level security;

create policy "products: owner read" on public.products
  for select using (auth.uid() = user_id);
create policy "products: owner insert" on public.products
  for insert with check (auth.uid() = user_id);
create policy "products: owner update" on public.products
  for update using (auth.uid() = user_id);
create policy "products: owner delete" on public.products
  for delete using (auth.uid() = user_id);

create index if not exists products_user_idx on public.products(user_id);

-- ---------------------------------------------------------------------
-- stock_history: every Stock In / Stock Out (sale) / Stock Count event
-- ---------------------------------------------------------------------
create table if not exists public.stock_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,
  type text not null check (type in ('stock-in', 'sale', 'count')),
  qty integer not null,
  unit_price numeric(12,2) not null default 0,
  staff text not null default 'Admin',
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.stock_history enable row level security;

create policy "history: owner read" on public.stock_history
  for select using (auth.uid() = user_id);
create policy "history: owner insert" on public.stock_history
  for insert with check (auth.uid() = user_id);

create index if not exists stock_history_user_idx on public.stock_history(user_id);
create index if not exists stock_history_product_idx on public.stock_history(product_id);
create index if not exists stock_history_date_idx on public.stock_history(occurred_on);

-- ---------------------------------------------------------------------
-- Optional: seed a starter product once you have your first user.
-- Replace YOUR-USER-ID with the uuid from Authentication → Users.
-- ---------------------------------------------------------------------
-- insert into public.products (user_id, name, category, sku, qty, min_stock, purchase_price, selling_price, supplier)
-- values ('YOUR-USER-ID', 'Paracetamol 500mg', 'Medicine', 'TB-000101', 142, 40, 500, 800, 'ABC Pharma Supplies');

-- =====================================================================
-- Multi-user business note (skip for launch, revisit later):
-- To let several staff logins share one business's data instead of
-- each user only seeing their own rows, add a `businesses` table and a
-- `business_id` column on settings/products/stock_history, then change
-- the RLS policies to check membership in a `business_members` table
-- instead of `auth.uid() = user_id`. Ask Claude to wire this up when
-- you're ready — it's a straightforward migration on top of this schema.
-- =====================================================================
