-- =====================================================================
-- TallyBust — migration v8: real, independent staff logins
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
--
-- Until now, "Staff" login only worked on a device that had already
-- been signed in as the Owner (a shared device session) — a staff
-- member's OWN phone had no way to authenticate on its own. This
-- migration gives every staff member a real, independent Supabase
-- Auth account of their own (built from Business Code + Username +
-- PIN — see src/staffAuth.js), scoped read/write access to their
-- employer's business data, WITHOUT being able to see or touch any
-- other business's data, and WITHOUT being able to manage the staff
-- roster itself (only the real Owner account can add/remove staff or
-- change PINs).
-- =====================================================================

-- Each business gets a short, shareable code (e.g. "K3F9QX") the Owner
-- gives to staff — it's baked into each staff member's login email so
-- their account only ever exists for this one business.
alter table public.settings add column if not exists business_code text unique;

create or replace function public.generate_business_code()
returns text
language sql
as $$
  select upper(substr(md5(gen_random_uuid()::text), 1, 6));
$$;

create or replace function public.set_business_code()
returns trigger
language plpgsql
as $$
begin
  if new.business_code is null then
    loop
      new.business_code := public.generate_business_code();
      exit when not exists (select 1 from public.settings where business_code = new.business_code);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_business_code on public.settings;
create trigger trg_set_business_code
  before insert on public.settings
  for each row execute function public.set_business_code();

-- Backfill any existing business that doesn't have a code yet.
do $$
declare r record;
begin
  for r in select user_id from public.settings where business_code is null loop
    update public.settings set business_code = public.generate_business_code() where user_id = r.user_id;
  end loop;
end $$;

-- Links a staff row to the staff member's own, separate auth.users
-- account. Null for staff added before this migration — see the "Set
-- up device login" button on the Staff page to backfill each of them.
alter table public.staff add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create index if not exists staff_auth_user_idx on public.staff(auth_user_id);

-- Lets a signed-in staff member read their OWN staff row (needed right
-- after they sign in, to find out their name/role and which business
-- they belong to) without being able to see anyone else's.
drop policy if exists "staff: self read" on public.staff;
create policy "staff: self read" on public.staff
  for select using (auth_user_id = auth.uid());

-- True if the signed-in user is a staff member of business `business_owner`.
create or replace function public.is_staff_of(business_owner uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.staff
    where user_id = business_owner and auth_user_id = auth.uid()
  );
$$;

-- products: staff can read/write the same rows the Owner can.
drop policy if exists "products: staff read" on public.products;
create policy "products: staff read" on public.products
  for select using (public.is_staff_of(user_id));
drop policy if exists "products: staff insert" on public.products;
create policy "products: staff insert" on public.products
  for insert with check (public.is_staff_of(user_id));
drop policy if exists "products: staff update" on public.products;
create policy "products: staff update" on public.products
  for update using (public.is_staff_of(user_id));

-- stock_history: staff can read the ledger and log new events.
drop policy if exists "history: staff read" on public.stock_history;
create policy "history: staff read" on public.stock_history
  for select using (public.is_staff_of(user_id));
drop policy if exists "history: staff insert" on public.stock_history;
create policy "history: staff insert" on public.stock_history
  for insert with check (public.is_staff_of(user_id));

-- refunds: staff can submit and (if their role allows it in the app) review.
drop policy if exists "refunds: staff all" on public.refunds;
create policy "refunds: staff all" on public.refunds
  for all using (public.is_staff_of(user_id)) with check (public.is_staff_of(user_id));

-- settings: staff need to read business name/currency, but never edit it.
drop policy if exists "settings: staff read" on public.settings;
create policy "settings: staff read" on public.settings
  for select using (public.is_staff_of(user_id));
