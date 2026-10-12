-- ===================== Bazarville — 360° / 3D product view (+ Trusted-by brands) =====================
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to re-run.
--
--   products.view_360    — ordered list of image URLs (frames of a 360° spin). Shoppers drag to rotate + zoom.
--   products.model_url   — optional 3D model (.glb) URL. Shoppers orbit, zoom and view from any angle.
--   settings.trusted_brands — list of {name, logo} shown in the "Trusted by" strip on the homepage
--                             (edited in Admin → Site Settings → Trusted by brands).

alter table public.products add column if not exists view_360 jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists model_url text not null default '';
alter table public.settings add column if not exists trusted_brands jsonb not null default '[]'::jsonb;
