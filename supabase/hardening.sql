-- =====================================================================
-- TallyBust — security hardening migration
-- Run in the Supabase SQL editor (or via `supabase db push` as a migration).
-- Review each section against your actual schema before running — column
-- names below are inferred from the frontend code and may need adjusting.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. STOP STORING STAFF PINS IN PLAINTEXT
--
-- Today `staff.pin` is a plain column, readable by anyone who can SELECT
-- the staff table — which every signed-in staff member on a business
-- currently can, via `select("*")`. Since the PIN is also the literal
-- credential material for that person's real Supabase Auth password
-- (see staffAuth.js), this means any staff member can read any coworker's
-- login. This section replaces plaintext storage with a salted hash that
-- is never returned to any client, and adds two RPCs so the app never
-- needs to read the raw PIN back after creation.
-- ---------------------------------------------------------------------

create extension if not exists pgcrypto;

alter table staff add column if not exists pin_hash text;

-- Hash whatever plaintext PIN the client sends, store only the hash, and
-- immediately null out the plaintext column so it never persists.
create or replace function staff_hash_pin_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pin is not null and new.pin <> '' then
    new.pin_hash := crypt(new.pin, gen_salt('bf'));
    new.pin := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_staff_hash_pin on staff;
create trigger trg_staff_hash_pin
  before insert or update of pin on staff
  for each row execute function staff_hash_pin_trigger();

-- One-time cleanup: hash any PINs already sitting in plaintext, then wipe
-- the plaintext column. Run this once, right after adding the trigger.
update staff set pin_hash = crypt(pin, gen_salt('bf')) where pin is not null and pin <> '';
update staff set pin = null;

-- Verifies a PIN for the "Acting As" quick-switch feature without ever
-- returning the hash or plaintext to the caller — just true/false, and
-- only for a staff row that belongs to the caller's own business.
create or replace function staff_verify_pin(p_staff_id bigint, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_owner uuid;
  v_caller_business uuid;
begin
  select pin_hash, user_id into v_hash, v_owner from staff where id = p_staff_id;
  if v_hash is null then return false; end if;

  -- Restrict to callers who belong to the SAME business as the target
  -- staff row (owner, or another staff member of that business) —
  -- otherwise anyone with a staff_id integer could probe PINs cross-tenant.
  select coalesce(
    (select user_id from staff where auth_user_id = auth.uid()),
    auth.uid()
  ) into v_caller_business;
  if v_caller_business is distinct from v_owner then return false; end if;

  return v_hash = crypt(p_pin, v_hash);
end;
$$;

revoke all on function staff_verify_pin(bigint, text) from public;
grant execute on function staff_verify_pin(bigint, text) to authenticated;

-- Lets the Owner (re-)set a staff member's PIN — used by "Set up device
-- login" for staff added before device logins existed, and by any future
-- "reset PIN" feature. Only the business owner may call this for their
-- own staff.
create or replace function staff_set_pin(p_staff_id bigint, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from staff where id = p_staff_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not authorized';
  end if;
  update staff set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_staff_id;
  return true;
end;
$$;

revoke all on function staff_set_pin(bigint, text) from public;
grant execute on function staff_set_pin(bigint, text) to authenticated;

-- Belt-and-braces: even if RLS is later loosened, make sure the raw
-- columns can never be selected by normal client roles.
revoke select (pin_hash) on staff from authenticated, anon;


-- ---------------------------------------------------------------------
-- 2. STOP SELF-ESCALATION VIA THE `settings` TABLE
--
-- The client updates its own settings row with `.update(next).eq('user_id', ...)`.
-- Unless something stops it, an authenticated user can send a raw PATCH
-- for their OWN row setting is_admin=true (full access to every
-- business's data via AdminDashboard) or subscription_status='active'
-- with a far-future expiry (free subscription forever). This trigger
-- locks those columns so only your service role (never shipped to the
-- browser) can change them.
-- ---------------------------------------------------------------------

create or replace function settings_lock_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
    new.subscription_status := old.subscription_status;
    new.subscription_expires_at := old.subscription_expires_at;
    new.trial_start_date := old.trial_start_date;
    new.business_code := old.business_code;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_settings_lock_admin on settings;
create trigger trg_settings_lock_admin
  before update on settings
  for each row execute function settings_lock_admin_columns();

-- Recommended follow-up (bigger refactor, do when convenient): move
-- is_admin off this user-writable table entirely and onto
-- auth.users.raw_app_meta_data, which is only settable via the Admin API
-- / service role and is included in the JWT as app_metadata. Then check
-- `(auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean` in
-- RLS and in the client instead of settings.is_admin. This trigger is a
-- solid immediate fix either way.


-- ---------------------------------------------------------------------
-- 3. VERIFY MULTI-TENANT ISOLATION (products, staff, stock_history,
--    refunds, write_offs, product_units)
--
-- The client queries these with NO user_id filter — e.g.
-- `supabase.from("products").select("*")` — so RLS is the ONLY thing
-- scoping results to the right business. Confirm each table has RLS
-- enabled and a policy along these lines. A staff member's session has
-- auth.uid() = their OWN auth id, not the owner's — so the policy has to
-- resolve "which business does this caller belong to" via the staff
-- table, not just compare auth.uid() to user_id directly.
-- ---------------------------------------------------------------------

create or replace function current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select user_id from staff where auth_user_id = auth.uid()),
    auth.uid()
  );
$$;

-- Example for `products` — replicate this shape for staff, stock_history,
-- refunds, write_offs, product_units, payment_receipts. Drop/recreate any
-- existing policy that's broader than this.
alter table products enable row level security;

drop policy if exists products_tenant_isolation on products;
create policy products_tenant_isolation on products
  for all
  using (user_id = current_business_id())
  with check (user_id = current_business_id());

-- `staff` needs an extra restriction: staff members should be able to
-- SELECT their business's roster (name/role, for the Acting-As list) but
-- must NOT be able to UPDATE/DELETE staff rows or change roles — only the
-- owner should.
alter table staff enable row level security;

drop policy if exists staff_select on staff;
create policy staff_select on staff
  for select
  using (user_id = current_business_id());

drop policy if exists staff_owner_write on staff;
create policy staff_owner_write on staff
  for insert with check (user_id = auth.uid());

drop policy if exists staff_owner_update on staff;
create policy staff_owner_update on staff
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists staff_owner_delete on staff;
create policy staff_owner_delete on staff
  for delete using (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 4. ENFORCE ROLE-GATED ACTIONS AT THE DATABASE, NOT JUST THE UI
--
-- Example: refunds should only be approvable by an Admin. The React code
-- already hides the approve/reject buttons from non-Admins
-- (`canManageRefunds={activeStaff.role === "Admin"}`), but that's cosmetic
-- — a Cashier's own valid session can otherwise call
-- `.from('refunds').update({status:'approved'})` directly. Replicate this
-- pattern for write_offs.
-- ---------------------------------------------------------------------

create or replace function current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from staff where auth_user_id = auth.uid()),
    'Admin' -- no staff row => this is the Owner
  );
$$;

alter table refunds enable row level security;

drop policy if exists refunds_tenant_select on refunds;
create policy refunds_tenant_select on refunds
  for select using (user_id = current_business_id());

drop policy if exists refunds_tenant_insert on refunds;
create policy refunds_tenant_insert on refunds
  for insert with check (user_id = current_business_id());

-- Only an Admin (Owner or staff with role='Admin') may move a refund out
-- of 'pending'.
drop policy if exists refunds_admin_update on refunds;
create policy refunds_admin_update on refunds
  for update using (user_id = current_business_id())
  with check (
    user_id = current_business_id()
    and (status = 'pending' or current_staff_role() = 'Admin')
  );


-- =====================================================================
-- After running this file:
--  1. Update App.jsx to call staff_verify_pin / staff_set_pin instead of
--     comparing to staff.pin directly (already patched in the files I've
--     given you).
--  2. Re-test: adding a staff member, switching "Acting As", and setting
--     up a returning staff member's device login.
--  3. In the Supabase dashboard, confirm "Confirm email" is ON for Auth
--     (closes the staff-email pre-registration risk) or move staff
--     account creation to a service-role Edge Function instead of the
--     public signUp() call.
-- =====================================================================
