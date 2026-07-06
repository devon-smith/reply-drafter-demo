-- Durable per-request usage/cost tracking. Rows are inserted server-side with
-- the service key; users may read only their own rows (for a future cost view).
create table if not exists public.usage_event (
  id            uuid primary key default gen_random_uuid(),
  user_email    text,
  ts            timestamptz not null default now(),
  input_tokens  int,
  output_tokens int,
  model         text,
  est_cost_usd  numeric
);
create index if not exists usage_event_user_ts_idx on public.usage_event (user_email, ts);

alter table public.usage_event enable row level security;
drop policy if exists usage_event_self_select on public.usage_event;
create policy usage_event_self_select on public.usage_event
  for select
  using (user_email = (auth.jwt() ->> 'email'));
