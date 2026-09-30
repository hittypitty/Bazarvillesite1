-- =====================================================================
-- BAZARVILLE — Phase 2: Customer accounts, Cart/Orders, Quotations, CRM
-- Run this ONCE in Supabase SQL Editor, after all previous migrations.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CUSTOMERS — buyer accounts, kept completely separate from
--    public.profiles (which is for STAFF/admin only). This matters for
--    security: profiles rows grant admin/catalog_manager access, so a
--    customer signup must never land in that table.
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company_name text,
  gstin text,
  phone text,
  created_at timestamptz default now()
);

-- Replaces the old trigger: it now branches on signup metadata so a
-- CUSTOMER signup (site's own Create Account form, which passes
-- { data: { account_type: 'customer', ... } }) goes into public.customers,
-- while an ADMIN invite (created from the Supabase dashboard, which has no
-- such metadata) still goes into public.profiles exactly as before.
-- This is the fix that stops a public signup from ever getting admin rights.
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

alter table public.customers enable row level security;
drop policy if exists "Customers read own row" on public.customers;
create policy "Customers read own row" on public.customers for select
  using (auth.uid() = id or public.is_admin());
drop policy if exists "Customers update own row" on public.customers;
create policy "Customers update own row" on public.customers for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- 2. ORDERS — created from Cart → Checkout. No payment gateway is wired
--    up yet (that needs a Razorpay/Stripe account + API keys you set up
--    separately) — payment_method defaults to Cash on Delivery / Bank
--    Transfer, confirmed manually, same trust model as the WhatsApp
--    enquiry flow already in use.
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  ref text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  customer_email text,
  shipping_address text,
  items jsonb not null default '[]', -- [{product_id,name,qty,price,color,size,print_option}]
  subtotal numeric not null default 0,
  status text not null default 'new', -- new|confirmed|processing|packed|dispatched|delivered|cancelled
  payment_method text not null default 'cod', -- cod|bank_transfer
  payment_status text not null default 'pending', -- pending|paid
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.orders enable row level security;
drop policy if exists "Anyone can place an order" on public.orders;
create policy "Anyone can place an order" on public.orders for insert with check (true);
drop policy if exists "Customers and admins read orders" on public.orders;
create policy "Customers and admins read orders" on public.orders for select
  using (customer_id = auth.uid() or public.is_admin());
drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders" on public.orders for update
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. QUOTES — admin-built CPQ quotes with a public share link
--    (quote.html?ref=...). Accepting a quote sends a WhatsApp message to
--    Bazarville rather than auto-creating an order — same human-confirms
--    pattern as the rest of the site, so no extra public-write policy is
--    needed for "accept".
-- ---------------------------------------------------------------------
create table if not exists public.quotes (
  id bigint generated always as identity primary key,
  ref text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_company text,
  customer_phone text,
  customer_email text,
  items jsonb not null default '[]', -- [{product_id,name,qty,price,total}]
  subtotal numeric not null default 0,
  status text not null default 'draft', -- draft|sent|accepted|rejected|expired
  valid_until date,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.quotes enable row level security;
drop policy if exists "Public read quotes by ref" on public.quotes;
create policy "Public read quotes by ref" on public.quotes for select using (true);
drop policy if exists "Admins write quotes" on public.quotes;
create policy "Admins write quotes" on public.quotes for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. CRM upgrade — enquiries get a real pipeline + optional company name,
--    and can be created manually by admin (a "lead" that didn't come
--    through the website, e.g. a phone call).
-- ---------------------------------------------------------------------
alter table public.enquiries add column if not exists company_name text default '';
alter table public.enquiries add column if not exists source text not null default 'website'; -- website|manual
alter table public.enquiries alter column status set default 'new';
-- widen the allowed pipeline values (old rows keep working — new/contacted/closed still valid)
alter table public.enquiries drop constraint if exists enquiries_status_check;
alter table public.enquiries add constraint enquiries_status_check
  check (status in ('new','contacted','qualified','quoted','won','lost','closed'));
