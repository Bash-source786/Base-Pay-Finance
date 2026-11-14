-- Run once in Supabase SQL Editor (BasePay project).
-- Each authenticated user can access only their own save.
create table if not exists public.basepay_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.basepay_saves enable row level security;
revoke all on table public.basepay_saves from anon, authenticated;
grant select, insert, update on table public.basepay_saves to authenticated;

drop policy if exists "Read own BasePay save" on public.basepay_saves;
create policy "Read own BasePay save"
  on public.basepay_saves for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Create own BasePay save" on public.basepay_saves;
create policy "Create own BasePay save"
  on public.basepay_saves for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Update own BasePay save" on public.basepay_saves;
create policy "Update own BasePay save"
  on public.basepay_saves for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
