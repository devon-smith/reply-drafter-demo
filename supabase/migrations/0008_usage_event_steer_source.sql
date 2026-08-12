-- v2 (Smart Steer Chips): extend usage_event so cost/behavior analytics can tell
-- WHICH surface drove a request and HOW the reply was steered.
--
--   kind         — 'draft' (a /draft generation, the default) or 'suggest' (a
--                  /suggest smart-chip classification call). Lets the cost view
--                  split drafting spend from suggestion spend.
--   steer_source — how the draft was steered: 'static_chip', 'smart_chip',
--                  'saved_steer', 'free_text', 'legacy', or 'none'. Null/absent
--                  on suggest rows and on pre-v2 rows.
--
-- Both are nullable with a safe default, so existing server inserts (which don't
-- yet set them) and historical rows remain valid.
alter table public.usage_event
  add column if not exists kind         text not null default 'draft',
  add column if not exists steer_source text;

create index if not exists usage_event_kind_ts_idx on public.usage_event (kind, ts);
