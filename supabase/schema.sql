-- =====================================================================
-- BAZARVILLE — Supabase schema (Phase 1: digital showroom + admin panel)
-- Run this once in your Supabase project's SQL editor (Project → SQL Editor
-- → New query → paste this whole file → Run).
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. PROFILES — one row per admin user, holds their role.
--    Super Admin / Catalog Manager matches the Phase 1 blueprint exactly.
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'catalog_manager' check (role in ('super_admin','catalog_manager')),
  created_at timestamptz default now()
);

-- Auto-create a profile the moment someone signs up via Supabase Auth.
-- New users default to catalog_manager — promote the first one to
-- super_admin manually (see setup notes at the bottom of this file).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'catalog_manager');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================================
-- 2. PRODUCTS
-- =====================================================================
create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  cat text not null default 'Uncategorised',
  profession text,
  purpose text,
  occasion text,
  brand text,
  moq int not null default 1,
  bulk int not null default 1,
  stock boolean not null default true,
  colors jsonb not null default '[]',   -- ["#1a1a1a","#c6f000"]
  sizes jsonb not null default '[]',    -- ["S","M","L"]
  tiers jsonb not null default '[]',    -- [{"min":20,"price":399}, ...]
  images jsonb not null default '[]',   -- ["https://.../file1.jpg", ...] — Storage public URLs
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================================
-- 3. COLLECTIONS — homepage "Featured Collections"
-- =====================================================================
create table if not exists public.collections (
  id bigint generated always as identity primary key,
  name text not null,
  tag text default '',
  image_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- =====================================================================
-- 4. SETTINGS — single row, global site settings
-- =====================================================================
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  whatsapp_number text not null default '919999999999',
  hero_images jsonb not null default '[]'   -- 3 URLs for the homepage hero
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- =====================================================================
-- 5. ENQUIRIES — logged when a visitor sends the WhatsApp enquiry
--    (matches blueprint section 11: website records enquiry events)
-- =====================================================================
create table if not exists public.enquiries (
  id bigint generated always as identity primary key,
  ref text not null,
  product_id bigint references public.products(id) on delete set null,
  product_name text,
  quantity int,
  created_at timestamptz default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- Public visitors can only READ products/collections/settings and INSERT
-- enquiries. Only signed-in admins (checked via the profiles table, not
-- the browser) can write products/collections; only super_admin can
-- change settings or other users' roles.
-- =====================================================================
alter table public.products enable row level security;
alter table public.collections enable row level security;
alter table public.settings enable row level security;
alter table public.enquiries enable row level security;
alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$ language sql security definer stable;

create or replace function public.is_super_admin()
returns boolean as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$ language sql security definer stable;

drop policy if exists "Public read products" on public.products;
create policy "Public read products" on public.products for select using (true);
drop policy if exists "Admins write products" on public.products;
create policy "Admins write products" on public.products for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read collections" on public.collections;
create policy "Public read collections" on public.collections for select using (true);
drop policy if exists "Admins write collections" on public.collections;
create policy "Admins write collections" on public.collections for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read settings" on public.settings;
create policy "Public read settings" on public.settings for select using (true);
drop policy if exists "Super admin writes settings" on public.settings;
create policy "Super admin writes settings" on public.settings for update
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "Anyone can log an enquiry" on public.enquiries;
create policy "Anyone can log an enquiry" on public.enquiries for insert with check (true);
drop policy if exists "Admins read enquiries" on public.enquiries;
create policy "Admins read enquiries" on public.enquiries for select using (public.is_admin());

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select
  using (auth.uid() = id or public.is_super_admin());
drop policy if exists "Super admin manages roles" on public.profiles;
create policy "Super admin manages roles" on public.profiles for update
  using (public.is_super_admin());

-- =====================================================================
-- STORAGE — one public bucket for product/collection/hero images
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('bazarville-media','bazarville-media', true)
on conflict (id) do nothing;

drop policy if exists "Public read media" on storage.objects;
create policy "Public read media" on storage.objects for select
  using (bucket_id = 'bazarville-media');
drop policy if exists "Admins upload media" on storage.objects;
create policy "Admins upload media" on storage.objects for insert
  with check (bucket_id = 'bazarville-media' and public.is_admin());
drop policy if exists "Admins delete media" on storage.objects;
create policy "Admins delete media" on storage.objects for delete
  using (bucket_id = 'bazarville-media' and public.is_admin());

-- =====================================================================
-- SETUP NOTES (read after running this file):
-- 1. Create your first admin login: Authentication → Users → Add user
--    (email + password). A row is auto-created in profiles as catalog_manager.
-- 2. Make that user a Super Admin by running:
--      update public.profiles set role = 'super_admin' where email = 'you@example.com';
-- 3. Copy your Project URL and anon public key (Project Settings → API)
--    into assets/supabase-config.js.
-- 4. Run the seed script (supabase/seed.sql) if you want the 16 demo
--    products and 8 demo collections pre-loaded — optional.
-- =====================================================================
