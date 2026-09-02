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
  owner_email text,
  trial_start_date date not null default current_date,
  subscription_status text not null default 'trial' check (subscription_status in ('trial', 'active', 'expired')),
  subscription_expires_at date,
  is_admin boolean not null default false,
  admin_pin text,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "settings: owner read" on public.settings
  for select using (auth.uid() = user_id);
create policy "settings: owner insert" on public.settings
  for insert with check (auth.uid() = user_id);
create policy "settings: owner update" on public.settings
  for update using (auth.uid() = user_id);

-- is_admin() is used below and by the app's admin dashboard
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from public.settings where user_id = auth.uid()), false);
$$;

create policy "settings: admin read all" on public.settings
  for select using (public.is_admin());
create policy "settings: admin update all" on public.settings
  for update using (public.is_admin());

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
  labels_printed_count integer not null default 0,
  labels_printed_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
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
create policy "products: admin read all" on public.products
  for select using (public.is_admin());

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
  captured_photo text,
  created_at timestamptz not null default now()
);

alter table public.stock_history enable row level security;

create policy "history: owner read" on public.stock_history
  for select using (auth.uid() = user_id);
create policy "history: owner insert" on public.stock_history
  for insert with check (auth.uid() = user_id);
create policy "history: admin read all" on public.stock_history
  for select using (public.is_admin());

create index if not exists stock_history_user_idx on public.stock_history(user_id);
create index if not exists stock_history_product_idx on public.stock_history(product_id);
create index if not exists stock_history_date_idx on public.stock_history(occurred_on);

-- ---------------------------------------------------------------------
-- app_config: single row holding the renewal message + payment
-- instructions the admin edits from the Admin Dashboard, visible to
-- every signed-in business (that's how an expired business sees it).
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  renewal_message text not null default 'Your TallyBust trial has ended. Renew your subscription to keep scanning and tracking stock.',
  payment_instructions text not null default 'Contact us to renew your subscription.',
  updated_at timestamptz not null default now()
);
insert into public.app_config (id) values (1) on conflict (id) do nothing;

alter table public.app_config enable row level security;

create policy "app_config: read all signed in" on public.app_config
  for select using (auth.role() = 'authenticated');
create policy "app_config: admin update" on public.app_config
  for update using (public.is_admin());
create policy "app_config: admin insert" on public.app_config
  for insert with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Making yourself the admin: sign up once in the app with the account
-- you want to use as your admin login, then run this (with your own
-- email) to flip the flag that unlocks the Admin Dashboard for you:
--
--   update public.settings set is_admin = true
--     where user_id = (select id from auth.users where email = 'you@example.com');
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- staff: employees a business owner adds, each with a PIN and role.
-- Used for "Acting As" on the Staff page so scans/adjustments are
-- attributed to a real person, not a free-text label.
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  pin text not null,
  role text not null default 'Cashier' check (role in ('Admin', 'Manager', 'Cashier', 'Storekeeper')),
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

create policy "staff: owner all" on public.staff
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists staff_user_idx on public.staff(user_id);

-- ---------------------------------------------------------------------
-- payment_receipts: a business attaches proof of payment here after
-- renewing; the admin reviews it on the Admin Dashboard and activates
-- the subscription once verified.
-- ---------------------------------------------------------------------
create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.payment_receipts enable row level security;

create policy "receipts: owner insert" on public.payment_receipts
  for insert with check (auth.uid() = user_id);
create policy "receipts: owner read own" on public.payment_receipts
  for select using (auth.uid() = user_id);
create policy "receipts: admin read all" on public.payment_receipts
  for select using (public.is_admin());
create policy "receipts: admin update" on public.payment_receipts
  for update using (public.is_admin());

create index if not exists receipts_user_idx on public.payment_receipts(user_id);

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
