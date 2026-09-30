-- =====================================================================
-- Run this ONCE in Supabase SQL Editor (Project → SQL Editor → New query
-- → paste this whole file → Run). Adds the columns needed for:
--   1) Settings → "Site font" picker          → settings.brand_font
--   2) Settings → "Animation intensity" picker → settings.animation_level
--   3) Product form → multi-select Profession  → products.professions
-- Safe to re-run — every statement is guarded with IF NOT EXISTS / is null.
-- =====================================================================
alter table public.settings add column if not exists brand_font text default 'inter';
alter table public.settings add column if not exists animation_level text default 'subtle';
update public.settings set brand_font = 'inter' where brand_font is null;
update public.settings set animation_level = 'subtle' where animation_level is null;

alter table public.products add column if not exists professions jsonb default '[]'::jsonb;
-- backfill: copy each product's existing single `profession` into the new
-- `professions` array so nothing looks empty in the admin panel after this runs.
update public.products
set professions = to_jsonb(array[profession])
where (professions is null or professions = '[]'::jsonb) and profession is not null and profession <> '';
