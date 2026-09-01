-- =====================================================================
-- TallyBust — migration v6: Admin PIN + role-picker front screen
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table public.settings add column if not exists admin_pin text;

-- Note: no RLS changes needed — settings already restricts reads/writes
-- to auth.uid() = user_id, and the front screen only ever reads its own
-- business's admin_pin using the signed-in session.
