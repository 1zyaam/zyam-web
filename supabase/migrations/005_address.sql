-- 005: store / office address shown on the public page with a directions button.
alter table public.accounts
  add column if not exists address text not null default '';

select 'accounts' as tbl, count(*) as rows from public.accounts;
