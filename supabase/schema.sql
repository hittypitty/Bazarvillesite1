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

-- Buyer accounts (customers) live in a SEPARATE table from staff profiles —
-- see section 6 below. This trigger branches on signup metadata so a public
-- "Create Account" signup can never land in profiles (= admin access).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  if (new.raw_user_meta_data->>'account_type') = 'customer' then
    insert into public.customers (id, email, full_name, company_name, phone)
    values (
      new.id, new.email,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'company_name',
      new.raw_user_meta_data->>'phone'
    );
  else
    insert into public.profiles (id, email, role)
    values (new.id, new.email, 'catalog_manager');
  end if;
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
  profession text,             -- primary profession (first entry of `professions`, kept for simple filtering)
  professions jsonb not null default '[]', -- ["Corporate","IT / Tech"] — admin form supports multi-select
  purpose text,                 -- primary purpose (first entry of `purposes`, kept for backward compatibility)
  occasion text,                -- primary occasion (first entry of `occasions`, kept for backward compatibility)
  purposes jsonb not null default '[]',  -- ["Client Gifts","Corporate Events"] — admin form supports multi-select
  occasions jsonb not null default '[]', -- ["Diwali","Annual Day"] — admin form supports multi-select
  brand text,
  moq int not null default 1,
  bulk int not null default 1,
  stock boolean not null default true,
  status text not null default 'published', -- 'draft' | 'published' — drafts are hidden from public listings
  colors jsonb not null default '[]',   -- ["#1a1a1a","#c6f000"]
  sizes jsonb not null default '[]',    -- ["S","M","L"]
  print_options jsonb not null default '[]', -- ["Screen Print","Embroidery"] — shown as a variant selector on the product page
  tiers jsonb not null default '[]',    -- [{"min":20,"price":399}, ...]
  images jsonb not null default '[]',   -- ["https://.../file1.jpg", ...] — Storage public URLs
  slug text,                    -- SEO-friendly URL slug, e.g. "steel-water-bottle-750ml"
  meta_title text,              -- <title> override for this product's page
  meta_description text,        -- meta description override for this product's page
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
  hero_images jsonb not null default '[]',  -- 3 URLs for the homepage hero
  brand_color text not null default '#c6f000',   -- admin "Brand colour" picker
  brand_font text not null default 'inter',      -- admin "Site font" picker
  animation_level text not null default 'subtle', -- admin "Animation intensity" picker: off | subtle | full
  -- editable taxonomy lists used by the product form's Purpose/Occasion
  -- dropdowns and Profession checkboxes — admin can add more from the
  -- product form ("+ Add new purpose/occasion/profession"), which appends
  -- to these arrays via updateSettings() so new products can reuse them.
  purposes jsonb not null default '["Client Gifts","Employee / Staff Gifts","Office & Workplace","Corporate Events","Awards & Recognition","Onboarding / Joining Kits","Marketing & Promotion","Branding & Corporate Identity","Conferences / Seminars / Workshops","Dealer / Distributor Gifts","Employee Appreciation","Welcome / Gift Kits","Festive Gifting","Travel / Utility Gifting","Team / Group Gifting"]',
  occasions jsonb not null default '["Diwali","New Year","Holi","Raksha Bandhan","Christmas","Eid","Independence Day","Republic Day","Company Anniversary","Annual Day","Product Launch","Corporate Events","Conferences & Exhibitions","Employee Joining / Onboarding","Employee Recognition & Awards","Employee Farewell","Client / Dealer Meets","Team Outings & Celebrations"]',
  custom_professions jsonb not null default '[]' -- professions the admin added beyond the built-in preset list (script.js BASE_PROFESSIONS)
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
  status text not null default 'new' check (status in ('new','contacted','qualified','quoted','won','lost','closed')), -- CRM pipeline
  notes text default '',
  followup_at timestamptz,
  company_name text default '',
  source text not null default 'website', -- 'website' | 'manual' (admin-added lead)
  created_at timestamptz default now()
);

-- =====================================================================
-- 6. CUSTOMERS — buyer accounts, kept separate from public.profiles
--    (staff/admin only). See handle_new_user() above.
-- =====================================================================
create table if not exists public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company_name text,
  gstin text,
  phone text,
  created_at timestamptz default now()
);

-- =====================================================================
-- 7. ORDERS — created from Cart → Checkout. No payment gateway wired up
--    yet; payment_method defaults to Cash on Delivery / Bank Transfer,
--    confirmed manually (same trust model as the WhatsApp enquiry flow).
-- =====================================================================
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  ref text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  customer_email text,
  shipping_address text,
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  status text not null default 'new', -- new|confirmed|processing|packed|dispatched|delivered|cancelled
  payment_method text not null default 'cod',
  payment_status text not null default 'pending',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================================
-- 8. QUOTES — admin-built CPQ quotes with a public share link
-- =====================================================================
create table if not exists public.quotes (
  id bigint generated always as identity primary key,
  ref text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_company text,
  customer_phone text,
  customer_email text,
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  status text not null default 'draft', -- draft|sent|accepted|rejected|expired
  valid_until date,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.quotes enable row level security;

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
drop policy if exists "Admins update enquiries" on public.enquiries;
create policy "Admins update enquiries" on public.enquiries for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Customers read own row" on public.customers;
create policy "Customers read own row" on public.customers for select
  using (auth.uid() = id or public.is_admin());
drop policy if exists "Customers update own row" on public.customers;
create policy "Customers update own row" on public.customers for update
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Anyone can place an order" on public.orders;
create policy "Anyone can place an order" on public.orders for insert with check (true);
drop policy if exists "Customers and admins read orders" on public.orders;
create policy "Customers and admins read orders" on public.orders for select
  using (customer_id = auth.uid() or public.is_admin());
drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders" on public.orders for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read quotes by ref" on public.quotes;
create policy "Public read quotes by ref" on public.quotes for select using (true);
drop policy if exists "Admins write quotes" on public.quotes;
create policy "Admins write quotes" on public.quotes for all
  using (public.is_admin()) with check (public.is_admin());

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
