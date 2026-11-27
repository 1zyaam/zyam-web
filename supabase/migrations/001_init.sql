-- Zyam Web — migration 001: core tables, RLS, admin helper, ad events
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is safe to run once on a fresh project. Do NOT run it twice without
-- dropping the tables first: the CREATE TABLE statements have no IF NOT EXISTS
-- guard on purpose, so a second run fails loudly instead of silently changing data.

-- UUID generation for primary keys
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  type text not null check (type in ('store', 'freelancer', 'influencer')),
  business_name text not null,
  slug text not null unique,
  tagline text,
  description text,
  whatsapp text,
  theme text not null default 'lavender',
  accent text,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'frozen', 'rejected', 'banned')),
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  social_links jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  description text,
  image_url text,
  video_link text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  link text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.bio_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  platform text not null,
  label text,
  url text not null,
  style text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  placement text not null default 'storefront-top',
  budget numeric not null default 0,
  spend numeric not null default 0,
  impressions int not null default 0,
  clicks int not null default 0,
  status text not null default 'running' check (status in ('running', 'paused')),
  created_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete set null,
  name text,
  email text,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table public.settings (
  id int primary key,
  admin_user_id uuid,
  platform_name text not null default 'Zyam Web'
);

-- Seed the single settings row. admin_user_id stays NULL until the owner
-- sets it in step 4 of DEPLOY.md (create the Auth user, then run the UPDATE).
insert into public.settings (id, admin_user_id, platform_name)
values (1, null, 'Zyam Web');

-- Helpful indexes
create index accounts_user_id_idx on public.accounts (user_id);
create index accounts_slug_idx on public.accounts (slug);
create index accounts_status_idx on public.accounts (status);
create index accounts_plan_idx on public.accounts (plan);
create index products_account_id_idx on public.products (account_id);
create index projects_account_id_idx on public.projects (account_id);
create index bio_links_account_id_idx on public.bio_links (account_id);
create index support_messages_status_idx on public.support_messages (status);
create index ad_campaigns_status_idx on public.ad_campaigns (status);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.accounts enable row level security;
alter table public.products enable row level security;
alter table public.projects enable row level security;
alter table public.bio_links enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.support_messages enable row level security;
alter table public.settings enable row level security;

-- Admin check: true when the signed-in user is the admin recorded in settings.
-- SECURITY DEFINER so it can read settings even while RLS is being evaluated.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.settings
    where id = 1
      and admin_user_id is not null
      and admin_user_id = auth.uid()
  );
$$;

-- Owner check for catalog rows (products / projects / bio_links):
-- true when the row belongs to an account owned by the signed-in user.
create or replace function public.is_account_owner(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.accounts
    where id = p_account_id
      and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
-- Public storefronts need to read account rows (name, theme, plan, status).
-- The app only renders a page when status = 'active'; other statuses show
-- the "temporarily unavailable" page.
create policy "accounts: public can read"
  on public.accounts for select
  to anon, authenticated
  using (true);

-- Owners manage their own account row.
create policy "accounts: owner can select own"
  on public.accounts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "accounts: owner can insert own"
  on public.accounts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "accounts: owner can update own"
  on public.accounts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "accounts: owner can delete own"
  on public.accounts for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "accounts: admin full access"
  on public.accounts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- products / projects / bio_links (same pattern for all three)
-- ---------------------------------------------------------------------------
create policy "products: public can read"
  on public.products for select
  to anon, authenticated
  using (true);

create policy "products: owner full access"
  on public.products for all
  to authenticated
  using (public.is_account_owner(account_id))
  with check (public.is_account_owner(account_id));

create policy "products: admin full access"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "projects: public can read"
  on public.projects for select
  to anon, authenticated
  using (true);

create policy "projects: owner full access"
  on public.projects for all
  to authenticated
  using (public.is_account_owner(account_id))
  with check (public.is_account_owner(account_id));

create policy "projects: admin full access"
  on public.projects for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "bio_links: public can read"
  on public.bio_links for select
  to anon, authenticated
  using (true);

create policy "bio_links: owner full access"
  on public.bio_links for all
  to authenticated
  using (public.is_account_owner(account_id))
  with check (public.is_account_owner(account_id));

create policy "bio_links: admin full access"
  on public.bio_links for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ad_campaigns
-- ---------------------------------------------------------------------------
-- The public storefront only ever shows a campaign that is running.
create policy "ad_campaigns: public can read running campaigns"
  on public.ad_campaigns for select
  to anon, authenticated
  using (status = 'running');

create policy "ad_campaigns: admin full access"
  on public.ad_campaigns for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- support_messages
-- ---------------------------------------------------------------------------
-- Anyone (including visitors who are not signed in) can send a message:
-- this powers the landing-page contact form and plan-upgrade requests.
create policy "support_messages: anyone can insert"
  on public.support_messages for insert
  to anon, authenticated
  with check (true);

-- Only the admin can read, update or delete messages.
create policy "support_messages: admin full access"
  on public.support_messages for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------
-- Everyone can read settings (the admin gate needs admin_user_id; the app
-- needs platform_name). Only the admin can change them.
create policy "settings: public can read"
  on public.settings for select
  to anon, authenticated
  using (true);

create policy "settings: admin can update"
  on public.settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Ad event counter
-- ---------------------------------------------------------------------------
-- Called by the storefront when a running ad is shown (impression) or
-- clicked. SECURITY DEFINER so anonymous visitors can count an event without
-- getting write access to ad_campaigns.
create or replace function public.record_ad_event(p_campaign uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind = 'impression' then
    update public.ad_campaigns
       set impressions = impressions + 1
     where id = p_campaign
       and status = 'running';
  elsif p_kind = 'click' then
    update public.ad_campaigns
       set clicks = clicks + 1
     where id = p_campaign
       and status = 'running';
  end if;
end;
$$;

-- Done. Next: run supabase/migrations/002_storage.sql, then follow DEPLOY.md.
