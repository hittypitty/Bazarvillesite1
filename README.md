# Bazarville — Digital Showroom

A mobile-first digital showroom for bulk & corporate gifting (Phase 1 blueprint) —
static HTML/CSS/JS site with a Supabase-backed admin panel.

## Structure
- `index.html`, `products.html`, `product.html`, `galaxy.html`, `about.html`,
  `collection.html`, `track.html` — the public site
- `admin.html` — Super Admin / Catalog Manager panel (Supabase Auth)
- `assets/` — shared CSS/JS, including `data-store.js` (all Supabase calls)
- `supabase/schema.sql` — full database schema + Row Level Security
- `supabase/seed.sql` — optional demo product/collection data
- `DEPLOY.md` — full Supabase + Vercel setup guide
- `SUPABASE_SETUP.md` — Supabase-only setup steps

## Quick start
See `DEPLOY.md` for the full step-by-step (Supabase → GitHub → Vercel).

Made by Arjun Ahirwar.
