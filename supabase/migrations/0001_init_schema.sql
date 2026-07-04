-- Family Gmail Reply Drafter — per-user config schema.
-- app_user mirrors auth.users (email) so kb/prompt rows can FK to a stable key.

create table if not exists public.app_user (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  created_at timestamptz not null default now()
);

-- Keep app_user in sync with Supabase Auth: insert a row on each new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_user (email)
  values (new.email)
  on conflict (email) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.kb_entry (
  id         uuid primary key default gen_random_uuid(),
  user_email text not null references public.app_user (email) on delete cascade,
  title      text,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists kb_entry_user_email_idx on public.kb_entry (user_email);

create table if not exists public.prompt_setting (
  user_email           text primary key references public.app_user (email) on delete cascade,
  system_prompt_append text,
  tone                 text,
  updated_at           timestamptz not null default now()
);
