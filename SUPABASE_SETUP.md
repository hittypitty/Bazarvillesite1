# Bazarville — Supabase Setup Guide

Follow these steps in order. Should take about 10–15 minutes.

## 1. Create a Supabase project
Go to [supabase.com](https://supabase.com) → New Project. Pick any name/region/password (save the DB password somewhere safe).

## 2. Run the schema
Supabase dashboard → **SQL Editor** → New query → paste the entire contents of `supabase/schema.sql` → **Run**.
This creates all tables (products, collections, settings, enquiries, profiles), Row Level Security policies, and the image storage bucket.

## 3. (Optional) Load the demo catalogue
New query → paste `supabase/seed.sql` → Run. This loads the same 16 demo products and 8 collections the static site shipped with, so you're not starting from a blank catalogue. Skip this if you'd rather start empty and add everything yourself in the admin panel.

## 4. Create your admin login
Dashboard → **Authentication → Users → Add user**. Enter an email and password (this is what you'll log into `admin.html` with). A row is auto-created for them in the `profiles` table with role `catalog_manager`.

## 5. Make yourself Super Admin
SQL Editor → New query:
```sql
update public.profiles set role = 'super_admin' where email = 'you@example.com';
```
(Replace with the email you used in step 4.) Run it.

## 6. Connect the site to your project
Dashboard → **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
Open `assets/supabase-config.js` and paste them in:
```js
const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

## 7. Test it
- Open `index.html` — the catalogue should load from Supabase (or your seeded demo data).
- Open `admin.html` — sign in with the email/password from step 4.
- Add a product with an image — it should appear on `products.html` immediately.
- Open a product page and click "Send WhatsApp Enquiry" — a row should appear in the `enquiries` table (check Table Editor in Supabase), and on `dashboard.html` (only visible while signed in as an admin, since that data is protected by RLS).

## Notes on what this does and doesn't include
- **Real, server-enforced security**: Row Level Security policies check the signed-in user's role on every request — a Catalog Manager genuinely cannot write to `settings` even by editing the page's JavaScript, because Postgres itself blocks it.
- **Not included**: bulk CSV upload, a draft/review/publish workflow, and an in-panel "invite a teammate" flow (blueprint sections 3–4). Roles are managed by running SQL directly for now.
- **Image storage**: uploads go to a public Supabase Storage bucket called `bazarville-media`. There's no automatic compression/resizing yet — the blueprint calls this out as a requirement for a later pass.
