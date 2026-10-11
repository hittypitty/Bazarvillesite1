-- ===================== Bazarville — per-user section permissions =====================
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query →
-- paste → Run). Safe to re-run — every statement below is a no-op if already applied.
--
-- What this adds:
--   - profiles.full_name     — display name shown in Admin → Users & Roles.
--   - profiles.permissions   — list of admin sections this user may use, e.g.
--                              {products,inventory,orders}. Super Admins ignore it (they can do
--                              everything). Valid values: dashboard, products, inventory,
--                              collections, enquiries, orders, quotes, settings.
--   - public.has_perm(text)  — true for a Super Admin, or for a user whose permissions list
--                              contains that section. Row Level Security now uses this, so the
--                              ticks you set in the admin panel are enforced by the DATABASE —
--                              not just hidden in the browser.
--   - Super Admin may now delete a team member's profile row (= revoke their admin access).
--
-- Existing team members keep working: every profile that already exists is granted all the
-- operational sections below (exactly what Catalog Managers could do before this migration).
-- New profiles start with NO permissions until a Super Admin ticks some in Users & Roles.

alter table public.profiles add column if not exists full_name text;

-- Add the permissions column AND backfill existing team members in one go — but only the first
-- time (when the column doesn't exist yet), so re-running this file never re-grants access you
-- have deliberately unticked since.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'permissions'
  ) then
    alter table public.profiles add column permissions text[] not null default '{}';
    update public.profiles
       set permissions = array['dashboard','products','inventory','collections','enquiries','orders','quotes']
     where role <> 'super_admin';
  end if;
end $$;

create or replace function public.has_perm(p text)
returns boolean as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and (role = 'super_admin' or p = any(permissions))
  );
$$ language sql security definer stable;

-- ---- products / collections --------------------------------------------------------
-- (Inventory also edits products — stock toggles and POS colour stock.)
drop policy if exists "Admins write products" on public.products;
create policy "Admins write products" on public.products for all
  using (public.has_perm('products') or public.has_perm('inventory'))
  with check (public.has_perm('products') or public.has_perm('inventory'));

drop policy if exists "Admins write collections" on public.collections;
create policy "Admins write collections" on public.collections for all
  using (public.has_perm('collections')) with check (public.has_perm('collections'));

-- ---- site settings -------------------------------------------------------------------
drop policy if exists "Super admin writes settings" on public.settings;
create policy "Super admin writes settings" on public.settings for update
  using (public.has_perm('settings')) with check (public.has_perm('settings'));

-- ---- enquiries -----------------------------------------------------------------------
drop policy if exists "Admins read enquiries" on public.enquiries;
create policy "Admins read enquiries" on public.enquiries for select
  using (public.has_perm('enquiries') or public.has_perm('dashboard'));
drop policy if exists "Admins update enquiries" on public.enquiries;
create policy "Admins update enquiries" on public.enquiries for update
  using (public.has_perm('enquiries')) with check (public.has_perm('enquiries'));

-- ---- orders (Inventory → POS Billing/History also reads & writes orders) ------------
drop policy if exists "Customers and admins read orders" on public.orders;
create policy "Customers and admins read orders" on public.orders for select
  using (customer_id = auth.uid() or public.has_perm('orders') or public.has_perm('inventory') or public.has_perm('dashboard'));
drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders" on public.orders for update
  using (public.has_perm('orders') or public.has_perm('inventory'))
  with check (public.has_perm('orders') or public.has_perm('inventory'));

-- ---- quotes --------------------------------------------------------------------------
drop policy if exists "Admins write quotes" on public.quotes;
create policy "Admins write quotes" on public.quotes for all
  using (public.has_perm('quotes')) with check (public.has_perm('quotes'));

-- ---- POS held sales ------------------------------------------------------------------
drop policy if exists "Admins manage pos_holds" on public.pos_holds;
create policy "Admins manage pos_holds" on public.pos_holds for all
  using (public.has_perm('inventory')) with check (public.has_perm('inventory'));

-- ---- team management (Super Admin only) ----------------------------------------------
drop policy if exists "Super admin manages roles" on public.profiles;
create policy "Super admin manages roles" on public.profiles for update
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "Super admin removes team members" on public.profiles;
create policy "Super admin removes team members" on public.profiles for delete
  using (public.is_super_admin());
