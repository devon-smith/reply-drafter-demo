# Project Scope Document — Family Gmail Reply Drafter (Supabase Multi-User)

> **Canonical plan.** Companion to `CLAUDE.md` (guidance) and `docs/gmail-addon.md` (Gmail
> add-on implementation detail). This is the task-level source of truth; if the docs disagree,
> this file wins. Extends the existing single-user Outlook system — which must keep working.
> Status legend: DONE / ACTIVE / PLANNED / POSTPONED.

## Project Overview

Extend the self-hosted Claude reply-drafter (Outlook add-in + Node/Express `/draft` backend on
a Hetzner VPS) with a **Gmail add-on** and **per-user customization** for a small family group
(~2–10 users). Each user gets their own knowledge base + prompt/tone, managed through a
lightweight **Supabase-backed dashboard** (Supabase Auth + Postgres + RLS). `/draft` looks up
the calling user's config in Supabase and assembles their prompt; the Gmail add-on stays thin
and calls `/draft` with the user's email. Private, unverified deployment; costs run on the
owner's Anthropic key.

## Goals & Success Criteria

- A family member opens an email in Gmail, taps the add-on, and gets a Claude-drafted reply
  inserted as an editable draft — using *their* KB and tone.
- Each user manages KB + prompt/tone in a dashboard they sign into with Google, seeing only
  their own data (RLS-enforced).
- The **Outlook add-in keeps working unchanged** (hard requirement).
- Secrets stay server-side: Anthropic key + Supabase **service-role** key live only on the VPS;
  the Gmail add-on never holds either.
- `/draft` p95 < 8 s including the Supabase lookup; readable errors on every failure path.

## Technical Architecture

```
 Gmail (Apps Script + CardService)                Dashboard (Supabase Auth, Google sign-in)
   reads open message/thread                        user manages their KB + prompt/tone rows
   Session.getActiveUser().getEmail()                        │  (RLS: user sees only own rows)
        │  POST /draft {from,subject,body,userEmail}         ▼
        │  header x-api-key                          ┌──────────────────────────┐
        ▼                                            │  Supabase (Postgres+Auth)│
 ┌───────────────────────────────┐   service-key    │  app_user / kb_entry /    │
 │  reply-server (Node/Express)  │◄────lookup────────┤  prompt_setting + RLS     │
 │  on the VPS behind Caddy      │                   └──────────────────────────┘
 │   /draft: look up user config │
 │   assemble prompt, call Claude│──► api.anthropic.com (Sonnet)
 │   files remain the fallback   │
 └───────────────────────────────┘
```

- **Supabase (Postgres + Auth + RLS):** per-user KB + prompt/tone. Google sign-in via Supabase
  Auth. RLS ensures each user reads/writes only their own rows.
- **Dashboard (Supabase's own stack):** small SPA (React/Vite) using `@supabase/supabase-js`
  with the **anon** key + Auth; all CRUD via RLS, no custom CRUD backend.
- **`/draft` backend (the integration seam):** identifies the user by `userEmail`, looks up
  their `kb_entry` + `prompt_setting` with the **service-role** key (bypasses RLS server-side),
  merges over the `prompt/system.md` + `kb/*.md` defaults, calls Claude. Files remain the
  fallback when a user has no rows.
- **Gmail add-on (thin client):** reads the message/thread, sends `{from, subject, body,
  userEmail}` + `x-api-key`, inserts via `createDraftReply`. Holds no Supabase/Anthropic creds.
- **Supabase MCP (build-time only):** used by Claude Code to create the project, run migrations,
  set RLS during development. The running backend uses `supabase-js` + a service key in `.env`,
  never MCP.

**Assumption (flagged):** Supabase **free tier, US-East** (near the Ashburn VPS). Trivially
changed at project creation.

## Detailed Roadmap

Effort in ideal hours/days (solo, Claude Code + Supabase MCP). `[P]` = parallelizable. The
existing Outlook v1, Milestone 2A, and the mounted `prompt/`+`kb/` `/draft` are the baseline
(all DONE) and not re-listed.

### Phase 0 — Foundation: repo, docs, Supabase project — **ACTIVE**

#### 0.1 — Canonical docs (fix the drift) — **DONE**
1. **`CLAUDE.md`** materialized at repo root, reflecting current reality (shared `/draft`
   backend; Outlook DONE incl. 2A.1–2A.4; Backend Phase 0 auth+overrides DONE; Gmail + Supabase
   now in scope; the hard constraints; deploy loop; repo hygiene). ✅
2. **`docs/project-scope.md`** (this file) materialized and reconciled with `gmail-addon.md`;
   README links to it; no "Gmail excluded" text remains. ✅

#### 0.2 — Supabase project + schema (via MCP) — **PLANNED (next external step)**
3. **Create the Supabase project** (free tier, US-East) via MCP. _0.5h._ _Done when:_ project
   exists; URL + anon + service keys captured (service key → VPS `.env` only, never committed).
4. **Schema migration** via MCP: `app_user`(id, email unique, created_at); `kb_entry`(id,
   user_email FK, title, content, created_at); `prompt_setting`(user_email PK/FK,
   system_prompt_append text, tone text, updated_at). _2h._ _Depends on:_ 0.2.3.
5. **RLS policies** via MCP: enable RLS on `kb_entry` + `prompt_setting`; a user may CRUD only
   rows where `user_email = auth.jwt() ->> 'email'`. _2h._ _Depends on:_ 0.2.4. _Done when:_
   cross-user reads return nothing under a user JWT; the service key still sees all. **Verify both.**
6. **Seed + smoke test** via MCP. _1h._ _Depends on:_ 0.2.5. `[P]`

### Phase 1 — Backend: secret + Supabase lookup + overrides — **PARTLY DONE**

#### 1.1 — Backward-compatible auth — **DONE** (commit `a30615e`)
1. Optional `x-api-key` on `/draft`: `API_SECRET` unset → enforce nothing; set → allow
   same-origin (Outlook pane) OR a valid `x-api-key` (Gmail add-on), else 401. `API_SECRET`
   documented in `.env.example`. Verified: Outlook path drafts header-less; header-less external
   call → 401; correct header passes. **Hard requirement met: Outlook not broken.** ✅

#### 1.2 — Supabase runtime integration
2. **Add `@supabase/supabase-js`**; init a service-role client from `SUPABASE_URL` +
   `SUPABASE_SERVICE_KEY` (env only); `/health` reports Supabase reachability. _1h._ _PLANNED._
   _Depends on:_ 0.2.3.
3. **User config lookup.** Given `userEmail`, fetch `kb_entry` rows + `prompt_setting` (service
   key). Cache briefly. _2–3h._ _PLANNED._ _Depends on:_ 1.2.2, 0.2.5. _Done when:_ known user's
   rows return; unknown user returns empty without error.
4. **Merge into prompt assembly.** _Merge machinery DONE_ (`buildSystemPrompt(overrides)` from
   Backend Phase 0 already appends `systemPromptAppend` / `kb` / `tone` over the file defaults,
   capped, backward-compatible). **Remaining:** feed it from the Supabase lookup (1.2.3) instead
   of only the request body. _1–2h._ _Depends on:_ 1.2.3.

### Phase 2 — Dashboard (Supabase Auth + CRUD UI) — **PLANNED**

1. **Frontend scaffold** (`dashboard/`, React + Vite, supabase-js anon key). _2–3h._ _Depends
   on:_ 0.2.3.
2. **Google sign-in** via Supabase Auth (enable Google provider; GCP OAuth client — *yours to
   click through*). _3–4h._ _Depends on:_ 2.1.
3. **KB manager UI** (CRUD `kb_entry` under RLS). _4–6h._ _Depends on:_ 2.2.
4. **Prompt/tone settings UI** (`prompt_setting`). _2–3h._ _Depends on:_ 2.2. `[P]`
5. **Deploy the dashboard** (Vercel/Netlify free, or Caddy on the VPS). _1–2h._ _Depends on:_
   2.3, 2.4.

### Phase 3 — Gmail add-on wiring — **PLANNED** (scaffold exists in `gmail-addon/`)

1. **Send `userEmail` + `x-api-key`** on the `/draft` call. Prefer the Supabase-backed config
   the backend now owns; keep `Settings.gs` UserProperties as a fallback. _2–3h._ _Depends on:_
   1.1 (done), 1.2.4.
2. **Thread context** — send `thread.getMessages()` concatenated. _2h._ _Depends on:_ 3.1. `[P]`
   (Note: the current scaffold already builds quoted-history body in `buildDraftPayload`.)
3. **Draft insertion + card polish** — confirm `createDraftReply` + `ComposeActionResponse`;
   error states in the card. _2–3h._ _Depends on:_ 3.1.
4. **Google-side rollout (YOURS):** `clasp login`/`create`/`push`; OAuth consent screen
   (External, **In production**); add family as test users; install. _2–3h._ _Depends on:_ 3.1–3.3.

### Phase 4 — Hardening — **PLANNED**

1. **Security review.** Service + Anthropic keys server-side only (grep client dirs); `.env`
   `600`; RLS re-verified cross-user; `x-api-key` enforced for the add-on. _3h._
2. **Rate limit + spend cap** on `/draft` (per-user via `userEmail`; daily Anthropic budget
   guard). _3h._ _Depends on:_ 1.1. `[P]`
3. **Observability.** Structured logs (no full bodies); request/error/latency + token/cost
   counters; `/health` (incl. Supabase) with alerting. _4–6h._ `[P]`
4. **Privacy note for family.** Document the data flow (VPS + Anthropic + Supabase), Anthropic
   retention, and how to delete a user's data. _2h._
5. **Runbook + tests.** Deploy/rollback runbook; unit tests for the merge logic + the auth
   branch (401/same-origin cases). _5–7h._ _Depends on:_ 1.1, 1.2.4.

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | `x-api-key` check breaks the live Outlook pane | Med | High | **Mitigated (Phase 1.1 DONE):** same-origin OR valid key; `API_SECRET` optional; Outlook path tested. |
| 2 | RLS misconfigured → a member sees another's data | Low–Med | High | Phase 0.2.5 policies + explicit cross-user verification (0.2.6); service key server-side only; never ship it to any client. |
| 3 | Scope creep — "quick family tool" is now a multi-user app | High | Medium | Estimated as a real ~4–6 day build. **Fallback:** the no-DB `UserProperties` path is already scaffolded in `gmail-addon/Settings.gs` if Supabase weight isn't worth it. Ship Phase 1 usable before the dashboard. |
| 4 | Doc/code drift across docs + two clients | Med | High | Phase 0.1 (DONE) makes `CLAUDE.md` + this file canonical, reconciled with `gmail-addon.md`; verify pushes reach GitHub main. |
| 5 | Privacy — email content to VPS + Anthropic + stored config | Low | High | Secrets server-side; RLS; no full-body logs; documented flow + retention + deletion (Phase 4.4); small trusted user set. |

## Tech Stack Summary

| Layer | Choice | Justification |
|-------|--------|---------------|
| Backend (shared) | Node 22 + Express, native `fetch` | Existing generation core; both clients call `/draft`; minimal deps. |
| LLM | Anthropic Messages API — Sonnet | Reply quality; owner's key, server-side. |
| Per-user store | Supabase (Postgres + Auth + RLS) | Managed Postgres + Google auth + row isolation out of the box. |
| Runtime DB client | `@supabase/supabase-js` (service role, on VPS) | Backend lookup bypassing RLS server-side; key in `.env`. |
| Build-time DB admin | Supabase MCP (via Claude Code) | Project/migrations/RLS during dev — NOT a runtime dependency. |
| Dashboard | React + Vite + supabase-js (anon + Auth) | Browser CRUD under RLS; no custom CRUD backend. |
| Auth | Supabase Auth — Google provider | Family signs in with Google; matches Gmail users. |
| Gmail client | Apps Script + CardService, `clasp` | Only supported Gmail add-on model; thin (no secrets). |
| Outlook client | Office.js + XML manifest (DONE) | Unchanged; must keep working. |
| Endpoint auth | Shared secret (`x-api-key`), optional/back-compat | Gate external callers without breaking same-origin Outlook. |
| Host | Hetzner CPX21 + Caddy + DuckDNS | Existing; backend + optional dashboard hosting; auto-TLS. |

## Excluded (and why)

- **Marketplace publishing / OAuth verification / CASA** — private family use with
  `gmail.addons.*` scopes avoids it; revisit only if going public.
- **Per-user Anthropic keys / billing** — owner's key covers a small family.
- **Voice from sent mail (2B)** — POSTPONED (no corpus); orthogonal to this track.
- **Microsoft Graph** — not needed; Outlook uses the quoted body, Gmail its native thread API.
