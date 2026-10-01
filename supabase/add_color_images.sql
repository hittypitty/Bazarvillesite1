-- ===================== Bazarville — colour-specific product images =====================
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run even if you've already run it before — the statement is a no-op if already applied.
--
-- What this adds:
--   products.color_images  (jsonb object) — e.g. {"#1a1a1a": ["url1","url2"], "#2454a6": ["url3"]}
--   Maps a colour (hex, matching an entry in products.colors) to its own set of images, so
--   clicking that colour swatch on the product page swaps the gallery to show that variant's
--   actual photos instead of the product's default images.
--
-- A colour with no entry here (or an empty array) just keeps showing the product's main
-- `images` (the existing photo gallery) — nothing changes for any product until an admin
-- deliberately assigns colour-specific photos to it from the product's Edit screen.

alter table public.products
  add column if not exists color_images jsonb not null default '{}';
