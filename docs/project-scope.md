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
| Gmail add-on code (Phase 3) | `gmail-addon/` sends `userEmail` (lowercased) + `x-api-key`, thread context, inserts via `createDraftReply` + `ComposeActionResponse`; local Settings = fallback. Renamed "Reply Drafter", branded/contextual card ("Replying to …"), `userinfo.email` scope (non-CASA). Verified live. Deploys via `clasp push`. |
| Usage & cost (Phase 4) | Durable `usage_event` metering (service-key insert, RLS self-read); dashboard **Usage & cost** page (Today/This-month tiles, cap bar, 30-day chart); verified writing + reading live. |
| Cost guardrails | Per-user UTC **daily token + request caps** (Supabase-backed, fail-open) and an in-memory **rate limit**; each returns a typed `429` the clients surface. Env-tunable (`DAILY_TOKEN_CAP`, `DAILY_REQUEST_CAP`, `RATE_LIMIT_PER_MIN`). |
| Dashboard redesign | Dark editorial **sidebar console** (Hanken Grotesk + JetBrains Mono, violet accent), tabbed nav with 1–4/⌘K/⌘S keys, breadcrumb + live endpoint pill, tone preset chips. Live on Vercel. |
| Boot self-check | `server/index.js` logs the NAMES of missing/placeholder/malformed required env at startup (catches unset key, open `/draft`, masked non-JWT service key). |

## OPEN — the only remaining work

Most of the original OPEN list is now DONE (see the audit): **OPEN-1** prod sign-in ✅ (Devon
signed in live on Vercel), **OPEN-2** add-on shipped ✅ (`clasp push`, installed, drafting),
**OPEN-3** `API_SECRET` enforced ✅ (keyless `/draft` → `401`, verified), **OPEN-4** full product
test ✅ (personalized live draft + `usage_event` written), rate-limit/daily-cap ✅, service_role key
rotated ✅. What genuinely remains:

- **OPEN-A — Family rollout (owner-side).** GCP OAuth consent screen: add each family member as a
  **Test user** (works now; refresh tokens expire ~7 days), or submit **"In production"** to drop
  the weekly re-auth (no CASA — scopes are add-on-scoped + `userinfo.email`). Then each member
  installs the add-on and fills in tone / writing material / KB in the dashboard.
- **OPEN-B — Privacy note.** A short family-facing note: message text flows to the VPS → Anthropic
  to draft; tone/KB/files live in Supabase under per-user RLS; how to delete.
- **OPEN-C — `.env` perms `600`** on the VPS (defense-in-depth; not served, but tighten anyway).
- **OPEN-D — Deploy the audit fixes.** Rebuild the VPS image so the boot self-check ships
  (`git pull && docker compose up -d --build`), and merge the audit PR so `main` == deployed.

See `AUDIT.md` for the full pre-family verification pass and the family-ready verdict.

## POSTPONED

- **Voice from sent mail (2B)** — no corpus yet; orthogonal to the Gmail track.
- **Microsoft Graph** — deliberately excluded; Outlook uses the quoted body, Gmail its native thread API.
- **Marketplace publishing / CASA** — private unverified deployment with `gmail.addons.*` scopes avoids it.

## Tech stack

Node 22 + Express (native `fetch`, no SDK) · Anthropic Messages API (Sonnet) · Supabase
(Postgres + Auth + RLS; `@supabase/supabase-js` service role on the VPS) · React + Vite dashboard
(supabase-js anon key, Vercel) · Apps Script + CardService (`clasp`) · Office.js + XML manifest ·
Hetzner CPX21 + Caddy + DuckDNS.
