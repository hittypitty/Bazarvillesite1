-- Adds: printing-option variants + per-product SEO fields (Hitarth's review round).
-- Safe to run multiple times.

alter table public.products add column if not exists print_options jsonb not null default '[]';
alter table public.products add column if not exists slug text;
alter table public.products add column if not exists meta_title text;
alter table public.products add column if not exists meta_description text;
