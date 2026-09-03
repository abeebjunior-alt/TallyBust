-- =====================================================================
-- TallyBust — migration v8: sales receipts
-- Run this ONCE in Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table public.stock_history add column if not exists receipt_no text;
create index if not exists stock_history_receipt_idx on public.stock_history(receipt_no);
