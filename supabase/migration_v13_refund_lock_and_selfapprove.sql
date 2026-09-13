-- =====================================================================
-- TallyBust — migration v13: lock a unit while its refund is pending
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
--
-- Refund never locked the scanned unit while its request sat waiting
-- for Admin confirmation — the unit stayed 'sold', so the same barcode
-- could be scanned into a second (or third) refund request before the
-- first was ever reviewed. This adds a 'pending_refund' status so,
-- like Write Off already does, a unit is locked the moment a refund is
-- requested and can't be refunded again until that one is resolved.
--
-- No app-code change needed beyond this for existing rows — nothing
-- currently in 'sold' status is affected; this only changes what a new
-- refund request does going forward.
-- =====================================================================

alter table public.product_units drop constraint if exists product_units_status_check;
alter table public.product_units add constraint product_units_status_check
  check (status in ('unstocked', 'in_stock', 'opened', 'sold', 'written_off', 'pending_write_off', 'pending_refund'));

notify pgrst, 'reload schema';
