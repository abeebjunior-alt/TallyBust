-- =====================================================================
-- TallyBust — migration: unit sales (selling loose units out of a pack)
-- Run this once in Supabase's SQL Editor. Safe on your existing data —
-- it only adds new columns/values, nothing is removed or overwritten.
-- =====================================================================

-- 1. New columns on products for optional per-unit selling ------------------
alter table public.products
  add column if not exists unit_enabled boolean not null default false,
  add column if not exists unit_qty integer,
  add column if not exists unit_price numeric(12,2),
  add column if not exists loose_units integer not null default 0;

-- 2. Allow 'unit-sale' as a stock_history transaction type ------------------
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
  add constraint stock_history_type_check check (type in ('stock-in', 'sale', 'count', 'refund', 'unit-sale'));
