-- ===================== Bazarville — manual "Trending" badge override =====================
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run even if you've already run it before — the statement is a no-op if already applied.
--
-- What this adds:
--   products.trending  (boolean) — when true, the product's card on the public site always
--   shows the 🔥 Trending badge, set from Admin → edit a product → ★ Trending (next to the
--   Status dropdown in the modal header). This overrides the auto-computed badge logic in
--   script.js's computeCardBadge() (Best Value / Popular / auto-Trending), which otherwise
--   picks the badge purely from pricing-tier math — this lets an admin pin a specific product
--   as Trending regardless of what that math says.
--
-- A product with no value here (or false) just keeps using the auto-computed badge — nothing
-- changes for any existing product until an admin deliberately marks one as Trending.

alter table public.products
  add column if not exists trending boolean not null default false;
