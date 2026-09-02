-- =====================================================================
-- TallyBust — migration v7: label-print tracking
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table public.products add column if not exists labels_printed_count integer not null default 0;
alter table public.products add column if not exists labels_printed_at timestamptz;
