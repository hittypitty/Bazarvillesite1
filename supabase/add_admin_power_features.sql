-- =====================================================================
-- Run this ONCE in Supabase SQL Editor. Adds columns for three new
-- admin-panel features:
--   1) Draft / Published product status   → products.status
--   2) Enquiry follow-up mini-CRM         → enquiries.status / .notes / .followup_at
-- Bulk CSV upload needs no new columns — it just calls the same product
-- insert/update logic as the "Add Product" form, once per row.
-- Safe to re-run.
-- =====================================================================
alter table public.products add column if not exists status text not null default 'published';
update public.products set status = 'published' where status is null;

alter table public.enquiries add column if not exists status text not null default 'new';
alter table public.enquiries add column if not exists notes text default '';
alter table public.enquiries add column if not exists followup_at timestamptz;
update public.enquiries set status = 'new' where status is null;

-- admins could previously only INSERT/SELECT enquiries — the follow-up UI
-- needs to UPDATE status/notes/followup_at, so add that policy too.
drop policy if exists "Admins update enquiries" on public.enquiries;
create policy "Admins update enquiries" on public.enquiries for update
  using (public.is_admin()) with check (public.is_admin());
