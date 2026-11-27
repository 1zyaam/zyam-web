-- Zyam Web — migration 002: storage bucket for catalog images
-- Run this in the Supabase SQL editor AFTER 001_init.sql
-- (Dashboard → SQL Editor → New query).
-- It creates the public 'catalog-images' bucket and the storage policies that
-- let anyone read images while only the signed-in owner can write to their
-- own folder: catalog-images/<their auth user id>/<file>.

-- Create the bucket (public so storefront images load without sign-in).
-- on conflict do nothing keeps the script safe to re-run.
insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage policies on storage.objects
-- ---------------------------------------------------------------------------

-- Anyone can read images in this bucket (storefronts are public).
drop policy if exists "catalog-images: public can read" on storage.objects;
create policy "catalog-images: public can read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'catalog-images');

-- A signed-in user can upload only into their own folder:
-- the first folder of the object path must equal their auth user id.
drop policy if exists "catalog-images: owner can upload to own folder" on storage.objects;
create policy "catalog-images: owner can upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'catalog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- A signed-in user can replace only their own images.
drop policy if exists "catalog-images: owner can update own files" on storage.objects;
create policy "catalog-images: owner can update own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'catalog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- A signed-in user can delete only their own images.
drop policy if exists "catalog-images: owner can delete own files" on storage.objects;
create policy "catalog-images: owner can delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Done. Verify in the Dashboard: Storage → catalog-images exists and is Public.
-- Next: follow DEPLOY.md step 4 (create the admin Auth user and set
-- settings.admin_user_id).
