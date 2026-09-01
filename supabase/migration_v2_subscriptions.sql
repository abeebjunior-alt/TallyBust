-- =====================================================================
-- TallyBust — migration v2: subscriptions, admin dashboard, photo-on-scan
-- Run this ONCE in SQL Editor on a project that already has schema.sql
-- applied. Safe to re-run (every statement is guarded).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. settings: trial + subscription + admin flag + owner email
-- ---------------------------------------------------------------------
alter table public.settings add column if not exists owner_email text;
alter table public.settings add column if not exists trial_start_date date not null default current_date;
alter table public.settings add column if not exists subscription_status text not null default 'trial'
  check (subscription_status in ('trial', 'active', 'expired'));
alter table public.settings add column if not exists subscription_expires_at date;
alter table public.settings add column if not exists is_admin boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. stock_history: optional photo captured at scan time
-- ---------------------------------------------------------------------
alter table public.stock_history add column if not exists captured_photo text;

-- ---------------------------------------------------------------------
-- 3. is_admin() helper — used by RLS policies below
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from public.settings where user_id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 4. admin read-all policies (owner-only policies from schema.sql stay
--    in place — Postgres OR's multiple permissive policies together)
-- ---------------------------------------------------------------------
drop policy if exists "settings: admin read all" on public.settings;
create policy "settings: admin read all" on public.settings
  for select using (public.is_admin());

drop policy if exists "settings: admin update all" on public.settings;
create policy "settings: admin update all" on public.settings
  for update using (public.is_admin());

drop policy if exists "products: admin read all" on public.products;
create policy "products: admin read all" on public.products
  for select using (public.is_admin());

drop policy if exists "history: admin read all" on public.stock_history;
create policy "history: admin read all" on public.stock_history
  for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 5. app_config: single row holding the renewal message + payment
--    instructions the admin edits, visible to every signed-in business
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  renewal_message text not null default 'Your TallyBust trial has ended. Renew your subscription to keep scanning and tracking stock.',
  payment_instructions text not null default 'Contact us to renew your subscription.',
  updated_at timestamptz not null default now()
);
insert into public.app_config (id) values (1) on conflict (id) do nothing;

alter table public.app_config enable row level security;

drop policy if exists "app_config: read all signed in" on public.app_config;
create policy "app_config: read all signed in" on public.app_config
  for select using (auth.role() = 'authenticated');

drop policy if exists "app_config: admin update" on public.app_config;
create policy "app_config: admin update" on public.app_config
  for update using (public.is_admin());

drop policy if exists "app_config: admin insert" on public.app_config;
create policy "app_config: admin insert" on public.app_config
  for insert with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. Make yourself the admin — run this LAST, after you've signed up
--    once in the app with the account you want to use as admin login.
--    Replace the email below with your own.
-- ---------------------------------------------------------------------
-- update public.settings set is_admin = true
--   where user_id = (select id from auth.users where email = 'you@example.com');
