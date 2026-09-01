-- =====================================================================
-- TallyBust — migration v4: soft-delete products (3-day restore window)
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table public.products add column if not exists deleted_at timestamptz;

-- Nothing else needed — the existing "products: owner ..." policies
-- already cover select/update/delete for the owner, and the app now
-- filters deleted_at itself (soft-delete = set it; restore = clear it;
-- permanent delete after 3 days = the app purges it automatically).
