-- ===================== Bazarville — multi-select Purpose & Occasion per product =====================
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run even if you've already run it before — every statement is a no-op if already applied.
--
-- What this adds:
--   products.purposes   (jsonb array) — the product's selected Purpose value(s), multi-select
--   products.occasions  (jsonb array) — the product's selected Occasion value(s), multi-select
--
-- Why: previously a product could only have ONE purpose and ONE occasion (text columns
-- products.purpose / products.occasion). Admin asked for multi-select here, same as Profession
-- already supports. We do NOT remove or rename the old products.purpose/products.occasion
-- columns — they're kept in sync (first selected value) purely for backward compatibility with
-- any older code/report that still reads them. All existing products and their data are
-- untouched by this migration; it only adds columns and backfills them from what's already there.

alter table public.products
  add column if not exists purposes jsonb not null default '[]',
  add column if not exists occasions jsonb not null default '[]';

-- Backfill: for any product that already has a single purpose/occasion but hasn't been
-- given the new array value yet, copy its existing value in as a one-item array so nothing
-- appears to "lose" its purpose/occasion after this migration runs.
update public.products
  set purposes = to_jsonb(array[purpose])
  where (purposes is null or purposes = '[]'::jsonb) and purpose is not null and purpose <> '';

update public.products
  set occasions = to_jsonb(array[occasion])
  where (occasions is null or occasions = '[]'::jsonb) and occasion is not null and occasion <> '';
