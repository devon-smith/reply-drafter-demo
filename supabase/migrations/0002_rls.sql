-- Row-Level Security: each user may access only their own rows, keyed by the
-- email claim in their Supabase Auth JWT. The backend uses the service-role key,
-- which bypasses RLS, so server-side lookups still see all rows.

alter table public.app_user       enable row level security;
alter table public.kb_entry        enable row level security;
alter table public.prompt_setting  enable row level security;

-- app_user: a signed-in user can read only their own row.
drop policy if exists app_user_self_select on public.app_user;
create policy app_user_self_select on public.app_user
  for select
  using (email = (auth.jwt() ->> 'email'));

-- kb_entry: full CRUD on own rows only.
drop policy if exists kb_entry_self_all on public.kb_entry;
create policy kb_entry_self_all on public.kb_entry
  for all
  using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));

-- prompt_setting: full CRUD on own row only.
drop policy if exists prompt_setting_self_all on public.prompt_setting;
create policy prompt_setting_self_all on public.prompt_setting
  for all
  using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));
