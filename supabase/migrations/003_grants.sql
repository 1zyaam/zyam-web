-- Zyam Web — migration 003: table/function grants for anon + authenticated.
-- BUG FIX (found 2026-11-27 during the live smoke test): migration 001 created
-- the tables and the RLS policies but never granted table privileges to the
-- anon/authenticated roles. RLS policies alone do not grant access — Postgres
-- also needs table-level GRANTs. Without these, every query from the app fails
-- with "permission denied for table accounts" (and the slug check, dashboard
-- and admin panel all break), even though the policies themselves are correct.
-- Safe to re-run: GRANT is idempotent.

grant select
  on public.accounts, public.products, public.projects, public.bio_links,
     public.ad_campaigns, public.settings
  to anon, authenticated;

grant insert, update, delete
  on public.accounts, public.products, public.projects, public.bio_links
  to authenticated;

grant insert, select, update, delete
  on public.ad_campaigns
  to authenticated;

grant insert on public.support_messages to anon, authenticated;
grant select, update, delete on public.support_messages to authenticated;

grant update on public.settings to authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_account_owner(uuid) to anon, authenticated;
grant execute on function public.record_ad_event(uuid, text) to anon, authenticated;

-- Verify: anon must be able to read accounts; authenticated must have full
-- access on accounts; the catalog-images bucket must exist and be public.
select 'accounts' as tbl,
  has_table_privilege('anon', 'public.accounts', 'select') as anon_select,
  has_table_privilege('authenticated', 'public.accounts', 'select, insert, update, delete') as auth_all;
select id, name, public from storage.buckets where id = 'catalog-images';
