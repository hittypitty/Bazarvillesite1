# Bazarville — Full Deployment Guide (Supabase + Vercel)

Two parts: **Supabase** (database + auth + storage) and **Vercel** (hosting the site live on the internet). Do Supabase first, since the site needs its keys before it's useful live.

---

## PART 1 — Supabase (database, login, image storage)

### 1. Create the project
Go to [supabase.com](https://supabase.com) → sign up (GitHub login is fastest) → **New Project**.
- Name: `bazarville` (anything works)
- Database password: pick a strong one, **save it somewhere** — you won't need it day-to-day but you'll need it if you ever connect a tool directly to Postgres.
- Region: pick the one closest to India (e.g. Singapore/Mumbai if listed).
- Wait ~2 minutes for it to finish provisioning.

### 2. Run the schema
Left sidebar → **SQL Editor** → **New query**.
Open `supabase/schema.sql` from this project, copy the whole file, paste it in, click **Run**.
You should see "Success. No rows returned." This created:
- `products`, `collections`, `settings`, `enquiries`, `profiles` tables
- Row Level Security policies (so only signed-in admins can write data)
- The `bazarville-media` storage bucket for images

### 3. (Optional) Load demo products
Same SQL Editor → New query → paste `supabase/seed.sql` → Run.
This loads the 16 demo products + 8 collections so you're not starting empty. Skip if you want to add everything yourself.

### 4. Create your admin login
Left sidebar → **Authentication → Users → Add user**.
- Enter your email + a password (this is what you'll log into `admin.html` with)
- Leave "Auto Confirm User" checked
- Click **Create user**

### 5. Make yourself Super Admin
SQL Editor → New query:
```sql
update public.profiles set role = 'super_admin' where email = 'you@example.com';
```
Replace with the email from step 4. Run it.

### 6. Get your API keys
Left sidebar → **Project Settings → API**.
Copy two values:
- **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
- **anon public** key (a long string starting with `eyJ...`)

### 7. Paste keys into the site
Open `assets/supabase-config.js` in the project and replace the placeholders:
```js
const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```
Save the file. **Supabase is now fully connected.**

---

## PART 2 — Vercel (put it live on the internet)

Bazarville is a plain static site (HTML/CSS/JS, no build step) — this is the easiest possible thing to deploy on Vercel.

### Option A — fastest (Vercel CLI, no GitHub needed)
1. Install Node.js if you don't have it already (you already work with Node, so likely already set up).
2. Open a terminal in the `bazarville` folder (the one containing `index.html`).
3. Run:
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```
4. It'll ask a few questions — accept the defaults (it auto-detects a static site, no build command needed).
5. It prints a live URL like `https://bazarville-xyz.vercel.app` — that's your site, live.
6. To push an update later, just run `vercel --prod` again from the same folder after making changes.

### Option B — GitHub + Vercel dashboard (better for ongoing work)
1. Create a new repo on GitHub, push this project to it:
   ```bash
   cd bazarville
   git init
   git add .
   git commit -m "Bazarville — initial deploy"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/bazarville.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → sign up/log in with GitHub.
3. **Add New → Project** → select your `bazarville` repo → **Import**.
4. Framework Preset: choose **Other** (it's plain HTML, no framework). Leave Build Command and Output Directory blank.
5. Click **Deploy**.
6. From now on, every `git push` to `main` automatically redeploys the live site — this is the version worth using once you're actively editing.

### Custom domain (optional)
Vercel project → **Settings → Domains** → add your domain (e.g. `bazarville.com`) → follow the DNS instructions it gives you (usually just adding a CNAME/A record at your domain registrar).

---

## PART 3 — Test the live site
1. Open your live URL (`index.html`) — the catalogue should load from Supabase (or your seeded demo data).
2. Open `yoursite.com/admin.html` — sign in with the email/password from Part 1, step 4.
3. Add a product with an image in the admin panel — refresh the public site, it should appear.
4. Open a product page on the live site and click **Send WhatsApp Enquiry** — check Supabase → Table Editor → `enquiries` — a new row should appear.
5. Open `dashboard.html` while signed in as admin — it should show that enquiry.

---

## A note on `admin.html` being public
Right now `admin.html` is reachable by anyone who knows the URL — but they can't actually do anything without a valid Supabase login, and even a signed-in Catalog Manager is blocked by Row Level Security from touching Settings. Still, for a real launch, consider either:
- Not linking to `/admin.html` from anywhere public (already the case), or
- Adding `noindex` (already in the page) plus optionally restricting it further later (e.g. a Vercel password-protect rule on that one path, available on paid Vercel plans).
