-- ===================== Bazarville — POS (counter billing) support =====================
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query →
-- paste → Run). Safe to re-run — every statement below is a no-op if already applied.
--
-- What this adds:
--   - products.color_stock — per-colour stock QUANTITY, e.g. {"#1a1a1a": 40, "#c6f000": 15}.
--     Used ONLY inside the admin POS screen (Inventory → POS Billing). The public site and the
--     main Products/Inventory views keep using the simple in-stock/out-of-stock toggle exactly
--     as before — this is additional detail just for ringing up counter sales, not a replacement.
--   - orders.source — 'web' (default, normal customer checkout) or 'pos' (a counter sale rung up
--     from the admin POS screen), so POS sales land in the same Orders list/dashboard counts as
--     everything else, just tagged with where they came from.
--   - public.pos_holds — "held" (parked) POS carts, so admin can park a half-built sale and come
--     back to it later without losing it, same idea as a hold button on a real billing counter.

alter table public.products
  add column if not exists color_stock jsonb not null default '{}';

alter table public.orders
  add column if not exists source text not null default 'web';

create table if not exists public.pos_holds (
  id bigint generated always as identity primary key,
  label text not null default '',
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  created_at timestamptz default now()
);

alter table public.pos_holds enable row level security;
drop policy if exists "Admins manage pos_holds" on public.pos_holds;
create policy "Admins manage pos_holds" on public.pos_holds for all
  using (public.is_admin()) with check (public.is_admin());
