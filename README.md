# Zyam Web

Zyam Web is a catalog-website platform: small businesses, freelancers and influencers sign up, pick a theme, and get a public page at `/s/<slug>` showing their products, portfolio projects or social links — with a WhatsApp contact button and no coding needed. The owner manages every account, ad campaign and support message from a hidden admin panel at `/admin`.

- **Free plan** — public page with a "Made with Zyam Web" footer; freezes after 45 days of inactivity (re-login unfreezes it).
- **Paid plan** — Rs 1,999/year, offer Rs 1,199/year. Footer removed, never freezes.

## Tech stack

- **Vite + React 18** — frontend
- **Tailwind CSS v3** — styling (light-purple brand palette, full dark mode)
- **react-router-dom** — routing
- **Supabase** — Auth, Postgres database (Row Level Security), Storage (`catalog-images` bucket)

## Folder structure

```
zyam-web-deploy/
├── index.html
├── vite.config.js / tailwind.config.js / postcss.config.js / vercel.json
├── .env.example                  # copy to .env and fill in (never commit .env)
├── DEPLOY.md                     # step-by-step guide to the live public URL
├── supabase/
│   └── migrations/
│       ├── 001_init.sql          # tables, RLS policies, admin helper, ad events
│       └── 002_storage.sql       # catalog-images bucket + storage policies
└── src/
    ├── main.jsx / App.jsx / index.css
    ├── lib/
    │   ├── supabase.js           # Supabase client + isSupabaseConfigured
    │   └── store.js              # THEMES, PLANS, helpers
    ├── components/               # TopBar, Logo, SwatchStrip
    └── pages/
        ├── Landing.jsx           # hero, themes, pricing, support form
        ├── SignupWizard.jsx      # type → details → theme → first items
        ├── Auth.jsx              # login (with 45-day unfreeze on re-login)
        ├── Dashboard.jsx         # client dashboard: items, settings, plan
        ├── Storefront.jsx        # public /s/:slug page
        └── Admin.jsx             # hidden CEO panel: Overview / Accounts / Ads / Support
```

## Run locally

```bash
npm install
cp .env.example .env
# Edit .env: set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_ADMIN_EMAIL
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

Build for production:

```bash
npm run build
```

## Deploy

Follow **[DEPLOY.md](DEPLOY.md)** — it walks through creating the free Supabase project, running the two SQL migrations, creating the admin user, pushing to GitHub and deploying free on Vercel. All free tier.

## Admin access

There is no visible admin button anywhere. Open `/admin` (or triple-tap the logo) and sign in with the admin email + password. Access is only granted when the signed-in user's id matches `settings.admin_user_id` in Supabase — see DEPLOY.md step 4.
