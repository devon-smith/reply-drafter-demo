-- v2 (Saved Steers): per-user reusable reply steers, managed in the dashboard and
-- shown as extra chips in the add-on. Small, capped, and RLS-isolated like the
-- rest of the per-user config.
create table if not exists public.saved_steers (
  id         uuid primary key default gen_random_uuid(),
  user_email text not null,
  label      text not null,
  steer_text text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists saved_steers_user_idx on public.saved_steers (user_email, sort_order);

-- Cap at 10 saved steers per user. Enforced in the database so neither the
-- dashboard (anon key, RLS) nor the backend (service key) can exceed it.
create or replace function public.enforce_saved_steers_cap()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.saved_steers where user_email = new.user_email) >= 10 then
    raise exception 'saved_steers limit reached (max 10 per user)';
  end if;
  return new;
end;
$$;

drop trigger if exists saved_steers_cap on public.saved_steers;
create trigger saved_steers_cap
  before insert on public.saved_steers
  for each row execute function public.enforce_saved_steers_cap();

-- RLS: a signed-in user (dashboard, anon key + Google auth) may read and manage
-- ONLY their own rows. The backend uses the service key and bypasses RLS.
alter table public.saved_steers enable row level security;

drop policy if exists saved_steers_self_select on public.saved_steers;
create policy saved_steers_self_select on public.saved_steers
  for select using (user_email = (auth.jwt() ->> 'email'));

drop policy if exists saved_steers_self_insert on public.saved_steers;
create policy saved_steers_self_insert on public.saved_steers
  for insert with check (user_email = (auth.jwt() ->> 'email'));

drop policy if exists saved_steers_self_update on public.saved_steers;
create policy saved_steers_self_update on public.saved_steers
  for update using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));

drop policy if exists saved_steers_self_delete on public.saved_steers;
create policy saved_steers_self_delete on public.saved_steers
  for delete using (user_email = (auth.jwt() ->> 'email'));
