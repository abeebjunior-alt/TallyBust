-- =====================================================================
-- TallyBust — migration v6: unit sales (sell loose units out of a pack)
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
--
-- Lets a product that's stocked by the pack (e.g. a box of Paracetamol)
-- also be sold one loose unit at a time (e.g. a single tablet). Each
-- product optionally records:
--   unit_sale_enabled  — whether this item can be sold in units at all
--   unit_name          — what to call one unit (e.g. "tablet", "sachet")
--   unit_qty_per_pack  — how many units make up one pack
--   unit_price         — price of a single unit
--   loose_units        — units currently available from a pack that's
--                        already been "opened" (started selling from)
--
-- When a unit sale is recorded and there aren't enough loose_units left
-- to cover it, the app opens another whole pack automatically: qty
-- (packs) goes down by 1 and loose_units goes up by unit_qty_per_pack,
-- then the sold units are subtracted. This is what keeps "12 units at
-- ₦100 each in a ₦1,200 pack" and "11 units (₦1,100) left in the open
-- pack, 11 packs untouched" in sync without any extra manual step.
-- =====================================================================

alter table public.products
  add column if not exists unit_sale_enabled boolean not null default false,
  add column if not exists unit_name text,
  add column if not exists unit_qty_per_pack integer not null default 0,
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists loose_units integer not null default 0;

-- Allow "unit-sale" as its own stock_history event type, alongside the
-- existing stock-in / sale / count, so unit sales show up in the ledger
-- distinctly from whole-pack sales.
alter table public.stock_history drop constraint if exists stock_history_type_check;
alter table public.stock_history add constraint stock_history_type_check
  check (type in ('stock-in', 'sale', 'count', 'unit-sale'));
