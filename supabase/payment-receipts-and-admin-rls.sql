-- =====================================================================
-- TallyBust — payment_receipts RLS + a correction to hardening.sql
-- Run this AFTER hardening.sql. Review table/column names against your
-- actual schema before running.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. CORRECTION to hardening.sql's settings_lock_admin_columns()
--
-- That trigger blocked anyone but `service_role` from changing is_admin /
-- subscription_status / etc. But AdminDashboard.jsx runs as a normal
-- AUTHENTICATED user (one whose settings.is_admin happens to be true) —
-- not as service_role. As written, the trigger would have silently
-- blocked the Admin Dashboard's own "Mark active" / "Mark expired" /
-- "Reset to trial" buttons from working on OTHER businesses' rows. This
-- replaces it with a version that also allows a genuine platform admin.
-- ---------------------------------------------------------------------

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from settings where user_id = auth.uid()), false);
$$;

revoke all on function is_platform_admin() from public;
grant execute on function is_platform_admin() to authenticated;

create or replace function settings_lock_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not is_platform_admin() then
    new.is_admin := old.is_admin;
    new.subscription_status := old.subscription_status;
    new.subscription_expires_at := old.subscription_expires_at;
    new.trial_start_date := old.trial_start_date;
    new.business_code := old.business_code;
  end if;
  return new;
end;
$$;
-- (trigger itself, trg_settings_lock_admin, already exists from
-- hardening.sql and will pick up this new function body automatically —
-- no need to re-create the trigger.)


-- ---------------------------------------------------------------------
-- 1. BASE RLS FOR `settings`
--
-- hardening.sql added the column-lock trigger but assumed RLS was already
-- enabled here. Confirm it actually is, and that the policy shape allows
-- the Admin Dashboard to read/update every business (not just its own).
-- ---------------------------------------------------------------------

alter table settings enable row level security;

drop policy if exists settings_select on settings;
create policy settings_select on settings
  for select
  using (user_id = auth.uid() or is_platform_admin());

drop policy if exists settings_insert on settings;
create policy settings_insert on settings
  for insert
  with check (user_id = auth.uid());

drop policy if exists settings_update on settings;
create policy settings_update on settings
  for update
  using (user_id = auth.uid() or is_platform_admin())
  with check (user_id = auth.uid() or is_platform_admin());

-- Staff members read their OWN business's settings too (currency,
-- business_name, etc. are needed for the normal app UI) — the app's
-- `current_business_id()` helper from hardening.sql resolves that, so
-- fold it into the select policy:
drop policy if exists settings_select on settings;
create policy settings_select on settings
  for select
  using (user_id = current_business_id() or is_platform_admin());


-- ---------------------------------------------------------------------
-- 2. `payment_receipts` — each business sees only its own; only a
--    platform admin can approve/reject.
-- ---------------------------------------------------------------------

alter table payment_receipts enable row level security;

drop policy if exists payment_receipts_select on payment_receipts;
create policy payment_receipts_select on payment_receipts
  for select
  using (user_id = auth.uid() or is_platform_admin());
  -- Deliberately NOT current_business_id(): subscription/billing is an
  -- Owner-level concern, not something staff logins should see.

drop policy if exists payment_receipts_insert on payment_receipts;
create policy payment_receipts_insert on payment_receipts
  for insert
  with check (user_id = auth.uid());

-- No UPDATE policy for regular users at all — only a platform admin may
-- change a receipt's status (approve/reject). This also stops a business
-- from inserting a receipt with status already set to 'approved'.
drop policy if exists payment_receipts_admin_update on payment_receipts;
create policy payment_receipts_admin_update on payment_receipts
  for update
  using (is_platform_admin())
  with check (is_platform_admin());

-- No DELETE policy at all => nobody but service_role can delete a receipt
-- (keeps a full audit trail of what was submitted/reviewed).

-- Force sane values on every insert, regardless of what the client sends
-- — a business shouldn't be able to submit a receipt that's already
-- 'approved', or backdate submitted_at/reviewed_at.
create or replace function payment_receipts_force_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.status := 'pending';
  new.reviewed_at := null;
  new.submitted_at := now();
  return new;
end;
$$;

drop trigger if exists trg_payment_receipts_force_pending on payment_receipts;
create trigger trg_payment_receipts_force_pending
  before insert on payment_receipts
  for each row execute function payment_receipts_force_pending();


-- ---------------------------------------------------------------------
-- 3. Cross-business READ access for the Admin Dashboard on products /
--    stock_history — it currently reads across ALL businesses
--    (`products.select("id,user_id")`, `stock_history.select("user_id,
--    created_at")`) purely for the "N products / last activity" summary.
--    hardening.sql's `for all` tenant policy would block that entirely
--    for a platform admin. Split SELECT out with an admin bypass; keep
--    writes tenant-only.
-- ---------------------------------------------------------------------

drop policy if exists products_tenant_isolation on products;

drop policy if exists products_select on products;
create policy products_select on products
  for select
  using (user_id = current_business_id() or is_platform_admin());

drop policy if exists products_write on products;
create policy products_write on products
  for insert with check (user_id = current_business_id());

drop policy if exists products_update on products;
create policy products_update on products
  for update using (user_id = current_business_id()) with check (user_id = current_business_id());

drop policy if exists products_delete on products;
create policy products_delete on products
  for delete using (user_id = current_business_id());

alter table stock_history enable row level security;

drop policy if exists stock_history_select on stock_history;
create policy stock_history_select on stock_history
  for select
  using (user_id = current_business_id() or is_platform_admin());

drop policy if exists stock_history_insert on stock_history;
create policy stock_history_insert on stock_history
  for insert with check (user_id = current_business_id());
-- No update/delete policy: stock history should be append-only.


-- ---------------------------------------------------------------------
-- 4. `app_config` (renewal message / payment instructions) — every
--    signed-in user needs to READ it (shown on the expired-subscription
--    screen), but only a platform admin should be able to WRITE it.
-- ---------------------------------------------------------------------

alter table app_config enable row level security;

drop policy if exists app_config_select on app_config;
create policy app_config_select on app_config
  for select
  using (true); -- readable by any authenticated user; it holds no secrets

drop policy if exists app_config_admin_write on app_config;
create policy app_config_admin_write on app_config
  for update
  using (is_platform_admin())
  with check (is_platform_admin());


-- =====================================================================
-- After running this file, sanity-check as two different logged-in
-- users (a plain business Owner, and one with is_admin=true):
--  - A plain Owner can see/update their own settings + submit a receipt,
--    but cannot see other businesses' rows and cannot approve their own
--    receipt.
--  - The platform admin can see/update every business, and approve or
--    reject any receipt.
-- =====================================================================
