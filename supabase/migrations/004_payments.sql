-- Zyam Web — migration 004: JazzCash payment receipts
-- Run this in the Supabase SQL editor AFTER 001–003
-- (Dashboard → SQL Editor → New query).
-- Clients pay Rs 1,199/year via JazzCash and upload a receipt screenshot.
-- The owner verifies the receipt in the admin panel (Payments tab) and the
-- account becomes Paid. Safe to re-run: CREATE TABLE IF NOT EXISTS + the
-- policies use DROP POLICY IF EXISTS first.

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  amount numeric not null default 1199,
  method text not null default 'jazzcash',
  receipt_url text not null,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists payment_receipts_account_id_idx on public.payment_receipts (account_id);
create index if not exists payment_receipts_status_idx on public.payment_receipts (status);

alter table public.payment_receipts enable row level security;

-- Owners insert + read their own receipts.
drop policy if exists "payment_receipts: owner can insert own" on public.payment_receipts;
create policy "payment_receipts: owner can insert own"
  on public.payment_receipts for insert
  to authenticated
  with check (public.is_account_owner(account_id));

drop policy if exists "payment_receipts: owner can select own" on public.payment_receipts;
create policy "payment_receipts: owner can select own"
  on public.payment_receipts for select
  to authenticated
  using (public.is_account_owner(account_id));

-- Admin full access.
drop policy if exists "payment_receipts: admin full access" on public.payment_receipts;
create policy "payment_receipts: admin full access"
  on public.payment_receipts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Grants (RLS policies alone do not grant access — see 003).
grant select, insert, update, delete on public.payment_receipts to authenticated;

-- Public bucket for receipt screenshots (same owner-folder pattern as
-- catalog-images: the first folder of the object path must be the uploader's
-- auth user id, so clients upload to payment-receipts/<their auth uid>/...).
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', true)
on conflict (id) do nothing;

drop policy if exists "payment-receipts: public can read" on storage.objects;
create policy "payment-receipts: public can read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'payment-receipts');

drop policy if exists "payment-receipts: owner can upload to own folder" on storage.objects;
create policy "payment-receipts: owner can upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "payment-receipts: owner can delete own files" on storage.objects;
create policy "payment-receipts: owner can delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verify: the table exists and the bucket is public.
select 'payment_receipts' as tbl, count(*) as rows from public.payment_receipts;
select id, name, public from storage.buckets where id = 'payment-receipts';
