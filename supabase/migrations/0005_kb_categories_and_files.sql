-- Track B / Prompt B1: richer writing-material KB — data model.

-- Category on kb_entry (existing rows backfill to 'fact' via the NOT NULL default).
alter table public.kb_entry
  add column if not exists category text not null default 'fact'
  check (category in ('fact','style','example'));

-- kb_file: uploaded writing-material. extracted_text is populated at upload time
-- (Prompt B4, an edge function); the backend consumes it (Prompt B2).
create table if not exists public.kb_file (
  id             uuid primary key default gen_random_uuid(),
  user_email     text not null,
  filename       text not null,
  storage_path   text not null,
  extracted_text text not null default '',
  category       text not null default 'fact' check (category in ('fact','style','example')),
  created_at     timestamptz not null default now()
);
create index if not exists kb_file_user_email_idx on public.kb_file (user_email);

-- RLS: each user may CRUD only their own kb_file rows; service role bypasses RLS.
alter table public.kb_file enable row level security;
drop policy if exists kb_file_self_all on public.kb_file;
create policy kb_file_self_all on public.kb_file
  for all
  using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));
