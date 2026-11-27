# Deploying Zyam Web — live public URL

Everything below is **free tier**: a free Supabase project, a free GitHub account and a free Vercel (Hobby) account. Nothing here costs money and nothing here needs a card.

**Steps only you (Zyam) can do:** creating the Supabase, GitHub and Vercel accounts and signing in to them (steps 1, 6 and 7). The rest is copy-paste: the SQL files, the `.env` values and the commands are all written out below.

## What you need before you start

- A Google account (for signing in to Supabase / Vercel / GitHub if you use Google sign-in).
- The admin email and password you want for the hidden admin panel — pick a strong password and keep it private. Nobody else, including the assistant, should ever know it.
- This project folder: `zyam-web-deploy/`.

---

## Step 1 — Create a free Supabase account + project (only you can do this)

1. Go to [supabase.com](https://supabase.com) and click **Start your project** → sign up (email or GitHub/Google).
2. Click **New project**.
3. Organisation: leave the default. **Name:** `zyam-web`. **Database password:** pick a strong one and save it somewhere safe (you will not need it for the website, only if you ever connect to the database directly).
4. **Region:** pick the one nearest your audience — `South Asia (Mumbai)` is the closest to Pakistan, or `US East` for a US audience. Either works.
5. Click **Create new project** and wait 1–2 minutes while it provisions.

## Step 2 — Run the two SQL migration files

1. In your Supabase project, open **SQL Editor** (left sidebar) → **New query**.
2. Open the file `supabase/migrations/001_init.sql` from this project folder, copy its entire contents, paste them into the SQL editor and click **Run**. You should see "Success. No rows returned".
3. Click **New query** again, paste the entire contents of `supabase/migrations/002_storage.sql` and click **Run**.
4. Quick check: open **Table Editor** — you should see the tables `accounts`, `products`, `projects`, `bio_links`, `ad_campaigns`, `support_messages` and `settings` (with one row, id = 1).

## Step 3 — Create the storage bucket (or verify the migration did it)

1. Open **Storage** (left sidebar). You should see a bucket called **`catalog-images`** marked **Public**.
2. If it is there, you are done — migration 002 already created it.
3. If it is missing: click **New bucket**, name it exactly `catalog-images`, turn **Public bucket** ON, click **Create bucket**, then re-run `supabase/migrations/002_storage.sql` from step 2 so the storage policies are applied.

## Step 4 — Create the admin Auth user + set `settings.admin_user_id` (only you can do this)

The hidden admin panel at `/admin` only opens for the one Auth user whose id is stored in `settings.admin_user_id`. Do this in two parts:

**4a. Create the admin user**

1. Open **Authentication** → **Users** → **Add user** → **Create new user**.
2. **Email:** your admin email (the same address you will put in `VITE_ADMIN_EMAIL` in step 5).
3. **Password:** your admin password. Leave **Auto Confirm User** ON so the account works immediately.
4. Click **Create user**.
5. Click the new user in the list and copy its **User UID** (a long id like `a1b2c3d4-…`). You will need it in 4b.

**4b. Point the settings row at that user**

1. Open **SQL Editor** → **New query** and run this, replacing the id with the User UID you just copied:

```sql
update public.settings
set admin_user_id = 'PASTE_THE_USER_UID_HERE'
where id = 1;
```

2. Confirm it worked by running:

```sql
select id, admin_user_id, platform_name from public.settings;
```

`admin_user_id` must now show the UID, not `null`. If it is still `null`, the admin gate will refuse every sign-in.

## Step 5 — Copy the Project URL + anon key into `.env`

1. In Supabase, open **Project Settings** (gear icon, bottom left) → **API**.
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`) and the **`anon` `public` key** (a long token starting with `eyJ…`). Use the **anon** key — never the `service_role` key.
3. In this project folder, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

4. Edit `.env` and fill in the three values:

```env
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…
VITE_ADMIN_EMAIL=your-admin-email@example.com
```

5. `.env` is already in `.gitignore` — it will never be pushed to GitHub. Never paste these keys into a chat, screenshot or public place.

## Step 6 — Push this folder to a new GitHub repo (only you can do this)

1. Go to [github.com](https://github.com) and sign in (create a free account first if you do not have one).
2. Click **+** (top right) → **New repository**. Name: `zyam-web`. Leave it **Public** or make it **Private** — either works with Vercel. Do **not** tick "Add a README" (the project already has one). Click **Create repository**.
3. In a terminal inside the `zyam-web-deploy` folder, run these commands exactly (replace `YOUR-GITHUB-USERNAME` with your GitHub username):

```bash
git init
git add .
git commit -m "Zyam Web — first deploy"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/zyam-web.git
git push -u origin main
```

If GitHub asks you to sign in, use your GitHub username and a personal access token as the password (GitHub no longer accepts account passwords for pushing).

## Step 7 — Create a free Vercel account, import the repo, set env vars, deploy (only you can do this)

1. Go to [vercel.com](https://vercel.com) and sign up for the free **Hobby** plan (use "Continue with GitHub" so Vercel can see your repo).
2. Click **Add New…** → **Project** → **Import** next to `zyam-web`.
3. On the project settings screen, leave the framework as **Vite** and the build settings as detected.
4. Open **Environment Variables** and add these three, with the **same values as your local `.env`**:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `VITE_ADMIN_EMAIL` | your admin email |

5. Click **Deploy** and wait for the build to finish (about a minute).
6. Vercel gives you the live URL, e.g. `https://zyam-web.vercel.app`. That is your public website.

> **Later deploys:** every `git push` to the `main` branch on GitHub automatically redeploys on Vercel. No other step is needed.

## Step 8 — Open the live URL and smoke-test

Open the Vercel URL in Chrome (or on your phone) and check each of these:

1. **Landing page loads** — hero, theme swatch strip, pricing (Free vs Paid, Rs 1,999 struck through → Rs 1,199), support form.
2. **Sign up** — go to `/signup`, create a test account (type → details → theme → first items). It should land on `/dashboard` with status **pending**.
3. **Log in** — log out, log back in at `/login` with the test account. Wrong password must show a clear error.
4. **Dashboard works** — add a product/project/link, upload an image, change the theme, open your public page link.
5. **Admin gate** — approve the test account: open `/admin`, sign in with your **admin email + password**. The panel must open. Approve the test account, then open its public page `/s/<slug>` — it should now show instead of "temporarily unavailable".
6. **Admin tabs** — click **Overview**, **Accounts**, **Ads**, **Support** one by one. Each tab must show its own content and stay highlighted.
7. **Support form** — send a message from the landing-page contact form; it must appear in the Admin → **Support** tab.
8. **Log out** — the Log out button in the dashboard and in the admin panel must return you to the home page.

If a step fails, check the two most common causes first: the three Vercel environment variables (step 7.4 — a missing `VITE_SUPABASE_URL` shows the "Connect Supabase to enable this" notice) and `settings.admin_user_id` (step 4b — a `null` value locks the admin gate).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Connect Supabase to enable this" on the live site | The Vercel env vars are missing or wrong. Re-add them in Vercel → Project → Settings → Environment Variables, then redeploy (Deployments → ⋯ → Redeploy). |
| Admin sign-in says "Wrong password / not admin" | Check step 4: the Auth user must exist, be confirmed, and its UID must be in `settings.admin_user_id`. |
| Signup fails / tables missing | Re-run `001_init.sql` in the Supabase SQL editor and check the Table Editor. |
| Image upload fails | Check Storage → `catalog-images` exists and is Public, and `002_storage.sql` ran without errors. |
| Vercel build fails | Run `npm run build` locally first; the error message there is the same one Vercel shows. |
