# Project Scope — Family Reply Drafter (closing record)

> **Canonical plan, closing state.** Companion to `CLAUDE.md` (guidance) and `docs/gmail-addon.md`
> (Gmail add-on detail). Most of this project is now shipped, so this doc is a record of what got
> built plus the small set of genuinely OPEN threads. Status: DONE / OPEN / POSTPONED.

## What got built

A self-hosted, TLS'd, **multi-user AI email reply-drafter across two platforms** (Outlook +
Gmail), sharing one backend, with **per-user personalization** (knowledge base + prompt/tone)
isolated by Supabase Row-Level Security and edited through a hosted dashboard.

```
Outlook add-in (Office.js) ─┐                        Dashboard (Vercel, React+Vite)
Gmail add-on  (Apps Script) ─┤ POST /draft            https://reply-drafter-demo.vercel.app
   userEmail + x-api-key     │ {from,subject,body,     Google sign-in; per-user KB + prompt/tone
                             ▼  userEmail?,overrides?}   under RLS (supabase-js + anon key)
        reply-devon.duckdns.org (Hetzner CPX21, Caddy TLS)          │
          reply-server:3000 (Node 22 + Express)                      ▼
            ├─ auth: same-origin (Outlook) OR x-api-key (add-on)  Supabase (Postgres+Auth+RLS)
            ├─ per-user lookup by userEmail (service-role key) ◄── app_user / kb_entry / prompt_setting
            ├─ prompt = system.md + kb/*.md + user config (Supabase > overrides > files)
            └─> api.anthropic.com (Sonnet, native fetch)
```

## Delivered — DONE

| Area | What shipped |
|------|--------------|
| Outlook v1 (Phase 1) | Auto-run pane, read-surface draft via `displayReplyForm`; deployed. |
| Interaction (2A) | Thread-aware `/draft` (2A.2); editable `prompt/system.md` + `kb/*.md` volumes (2A.3); compose-surface insert, manifest `1.2.0.0` (2A.4). |
| Backend multi-caller (Phase 0/1.1) | Optional `x-api-key` auth (same-origin OR key); per-user `overrides` pass-through. Outlook path unchanged. |
| Supabase (Phase 0.2) | Project `reply-drafter` (us-east-1); `app_user`/`kb_entry`/`prompt_setting`; RLS verified both ways (owner-only reads, service role sees all, cross-user write blocked); advisors clean. Migrations in `supabase/migrations/`. |
| Backend per-user (Phase 1.2) | `@supabase/supabase-js` service-role lookup by `userEmail`; Supabase config > request overrides > file defaults. `/health` reports `supabaseConfigured`. **Live on the VPS**, verified end-to-end (personalized draft returned). |
| Dashboard (Phase 2) | React+Vite SPA; Google sign-in; KB + prompt/tone CRUD under RLS. **Deployed: `https://reply-drafter-demo.vercel.app`** (build succeeded, env set, prod origin authorized in GCP). |
| Gmail add-on code (Phase 3) | `gmail-addon/` sends `userEmail` (lowercased) + `x-api-key`, thread context, inserts via `createDraftReply` + `ComposeActionResponse`; local Settings = fallback. Verified against the live backend. Deploys via `clasp push`. |

## OPEN — the only remaining work

- **OPEN-1 — Dashboard prod sign-in check.** Click "Sign in with Google" on
  `https://reply-drafter-demo.vercel.app`, confirm OAuth completes and lands on the settings page.
  (Local sign-in worked; prod origin is authorized — this catches any missed redirect/origin.)
- **OPEN-2 — Ship the Gmail add-on.** `clasp push` + install for yourself, then roll out to family
  (GCP consent screen External + In production, add test users). See `gmail-addon/README.md`.
- **OPEN-3 — Enable `API_SECRET` before sharing.** Until set, `/draft` is open to anyone with the
  URL (they spend the Anthropic budget). Set `API_SECRET` on the VPS + the matching `DRAFT_SECRET`
  Script Property. Outlook keeps working (same-origin rule). **Do this before OPEN-2 reaches anyone.**
- **OPEN-4 — Full product test.** Change tone in the deployed dashboard → open a real Gmail message
  → Generate reply → confirm the draft reflects the change. Exercises the whole stack.
- **OPEN-5 — Hardening + privacy note.** Per-user rate limit / daily spend cap on `/draft`;
  `.env` perms `600`; rotate the service_role key (it was pasted in a session transcript); a short
  family privacy note (email flows to the VPS + Anthropic; what's stored in Supabase; deletion).

## POSTPONED

- **Voice from sent mail (2B)** — no corpus yet; orthogonal to the Gmail track.
- **Microsoft Graph** — deliberately excluded; Outlook uses the quoted body, Gmail its native thread API.
- **Marketplace publishing / CASA** — private unverified deployment with `gmail.addons.*` scopes avoids it.

## Tech stack

Node 22 + Express (native `fetch`, no SDK) · Anthropic Messages API (Sonnet) · Supabase
(Postgres + Auth + RLS; `@supabase/supabase-js` service role on the VPS) · React + Vite dashboard
(supabase-js anon key, Vercel) · Apps Script + CardService (`clasp`) · Office.js + XML manifest ·
Hetzner CPX21 + Caddy + DuckDNS.
