-- =====================================================================
-- Run this ONCE in Supabase SQL Editor if you already ran schema.sql
-- before this file existed — it just adds one column for the new
-- "brand colour theme" feature in the admin panel's Settings page.
-- Safe to re-run (it no-ops if the column already exists).
-- =====================================================================
alter table public.settings add column if not exists brand_color text default '#c6f000';
update public.settings set brand_color = '#c6f000' where brand_color is null;
