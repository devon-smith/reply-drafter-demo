# CLAUDE.md — reply-drafter-demo

Project context for Claude Code. Read this before making changes. This file is the canonical
guidance; the full task-level plan lives in `docs/project-scope.md`, and the Gmail add-on
detail in `docs/gmail-addon.md`. If those ever disagree, `docs/project-scope.md` wins and
should be corrected.

## What this is

A self-hosted Claude email reply-drafter. A user reads an email, opens the add-in, and it reads
the message, calls a backend, asks Claude for a reply, and hands that reply back into the mail
client's editable reply. Two clients now share ONE backend:

- **Outlook add-in** (DONE, deployed) — Office.js task pane on the read surface + a compose
  surface; inserts via `displayReplyForm` / `body.setAsync`. Single Stanford M365 mailbox.
- **Gmail add-on** (code DONE; Google-side rollout pending) — Apps Script + CardService for a
  small family group (~2–10 users), each with their own knowledge base + prompt/tone, calling the
  same `/draft`. Per-user config via a hosted dashboard (`https://reply-drafter-demo.vercel.app`).

This repo is the single source of truth for the whole project — both clients and the backend.

## Current status

- **Phase 1 (Outlook generation slice): COMPLETE and deployed.** Outlook → VPS `/draft` →
  Anthropic → drafted reply. Verified end to end on a real threaded email.
- **Milestone 2A (interaction): COMPLETE.** Auto-run pane (2A.1); thread-aware `/draft` using
  quoted history (2A.2); editable `prompt/system.md` + `kb/*.md` mounted volumes (2A.3);
  compose-surface insert (2A.4, manifest `1.2.0.0`).
- **Backend Phase 0 (multi-caller prep): DONE.** `/draft` has optional `x-api-key` auth
  (backward-compatible: same-origin OR valid key) and per-user `overrides` pass-through layered
  on the mounted-file defaults. Both are no-ops unless `API_SECRET` / `overrides` are present.
- **Gmail + Supabase multi-user: BUILT.** Supabase project + RLS live; backend per-user lookup
  live on the VPS; dashboard deployed (`reply-drafter-demo.vercel.app`); Gmail add-on wired
  (`gmail-addon/`, deploys via `clasp push`). Remaining work is the OPEN list in
  `docs/project-scope.md` (clasp rollout, enable `API_SECRET`, product test, hardening).
- **Voice from sent mail: POSTPONED** (no corpus yet; orthogonal to the Gmail track).

## Architecture

```
Outlook (any device) ─HTTPS─┐
Gmail add-on (Apps Script) ─┤ POST /draft {from,subject,body,userEmail?,overrides?}  (+ x-api-key for the add-on)
                            ▼
              reply-devon.duckdns.org  (Hetzner CPX21, 87.99.145.62)
                Caddy :443  (auto-TLS, reverse proxy)
                  └─> reply-server:3000  (Node 22 + Express, BEHIND_PROXY=1)
                        ├─ serves the Outlook static pane (taskpane.html/css, manifest, icons)
                        ├─ GET  /health  -> {status, model, keyConfigured}
                        └─ POST /draft   -> {reply}
                              ├─ auth: same-origin (pane) OR x-api-key (add-on), if API_SECRET set
                              ├─ prompt = prompt/system.md + kb/*.md  (+ per-user overrides / [planned] Supabase rows)
                              └─> api.anthropic.com  (Sonnet, native fetch)
   Planned: Supabase (Postgres+Auth+RLS) for per-user KB/prompt; a small dashboard (supabase-js
   + anon key) for family self-service; the backend looks up config with the service-role key.
```

- **Backend:** `server/index.js` — Express, serves static files from the repo root
  (`express.static` ignores dotfiles, so `.env` is never served), `/draft` + `/health`. Calls
  Anthropic with native `fetch` (Node 22 global), no SDK. Reads `prompt/system.md` + `kb/*.md`
  fresh per request (mounted volumes → editable without a rebuild).
- **Outlook add-in:** self-contained `taskpane.html` (Office.js + inline script), auto-runs on
  open. Read surface uses `displayReplyForm`; compose surface uses `body.setAsync`. No Graph.
- **Gmail add-on:** `gmail-addon/` (clasp project). Thin client — reads message/thread, POSTs
  `/draft` via `UrlFetchApp`, inserts via `createDraftReply` + `ComposeActionResponse`. Holds no
  Anthropic or Supabase credentials. Uses only add-on-scoped Gmail scopes (no CASA).
- **Edge:** Caddy terminates TLS for the DuckDNS hostname and reverse-proxies. Pane + API are
  same-origin → no CORS.
- **Host:** Hetzner CPX21 (4 GB / 80 GB), Ubuntu 24.04, `87.99.145.62`, `reply-devon.duckdns.org`.

## Repo layout

- `server/index.js` — backend (`/draft`, `/health`, static serving, auth, prompt assembly)
- `prompt/system.md` — editable drafting prompt (source of truth; code has a fallback)
- `kb/*.md`, `kb/*.txt` — knowledge-base fact files, read fresh per request (`kb/.gitkeep`)
- `taskpane.html` / `taskpane.css` / `taskpane.js` / `commands.html` — Outlook add-in
- `manifest.xml` — Outlook manifest. `<Id>` `3f2a7c14-9b6e-4d21-a8f3-1c5e9d0b7a42`,
  `<Version>` `1.2.0.0`, URLs at `reply-devon.duckdns.org`. Bump `<Version>` on any manifest
  change or Outlook serves a cached copy.
- `icon-16/32/64/80/128.png` — add-in icons (served from the VPS)
- `gmail-addon/` — Gmail add-on (Apps Script): `Code.gs`, `Backend.gs`, `Settings.gs`,
  `appsscript.json`, `.clasp.json.example`, `README.md`
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `infra/Caddyfile` — deploy
- `.env.example` — env template (real `.env` lives only on the VPS, gitignored)
- `docs/` — `project-scope.md` (canonical plan), `gmail-addon.md` (Gmail detail)

## Hard constraints — DO NOT violate

1. **The Outlook add-in must keep working, unchanged.** It calls `/draft` same-origin with NO
   secret header. Any auth added to `/draft` must let same-origin callers through without a key.
   Test the Outlook path before and after backend changes.
2. **Secrets are server-side only.** `ANTHROPIC_API_KEY` and (planned) `SUPABASE_SERVICE_KEY`
   live in `.env` on the VPS, injected via docker compose `env_file`. They must NEVER appear in
   any client file (`taskpane.*`, `manifest.xml`, `gmail-addon/*`, dashboard). Nothing matching
   `sk-ant-`, and no service key, in client files — ever. The Gmail add-on holds only its own
   `DRAFT_SECRET` (in Script Properties) and `DRAFT_URL`.
3. **No Microsoft Graph.** The Outlook pane uses Office.js current-item APIs only. Thread
   context comes from the quoted body, not Graph. Gmail uses its native thread API instead.
4. **No restricted Gmail scopes.** The Gmail add-on uses only `gmail.addons.*`,
   `script.external_request`, and `userinfo.email` (the last is non-sensitive — needed for
   `Session.getActiveUser().getEmail()`, which drives the per-user Supabase lookup; it does NOT
   trigger CASA). Adding a broad/restricted Gmail scope (`gmail.readonly`, etc.) triggers
   Google's CASA assessment — avoid it.
5. **Native `fetch`, not `@anthropic-ai/sdk`.** Keep the dependency tree minimal (currently
   `express`; `@supabase/supabase-js` is the only planned runtime add).
6. **Server listens plain HTTP when `BEHIND_PROXY=1`.** Caddy owns TLS. Do NOT reintroduce
   dev-cert / HTTPS logic on the VPS path (it previously crash-looped).
7. **Vanilla JS Outlook pane.** No framework/bundler; keep it one self-contained `taskpane.html`.
8. **Supabase MCP is build-time only.** Use it to create the project, run migrations, set RLS
   during dev. The running backend uses `supabase-js` with a service key from `.env` — never MCP.
9. **Scoped changes only.** Touch only the files a task names. `node --check` must pass on any
   JS you edit.

## `/draft` contract

`POST /draft` with `{ from, subject, body, userEmail?, overrides? }` → `{ reply }`.
- `overrides`: optional `{ systemPromptAppend?, kb?, tone? }`, layered on the file defaults;
  absent → output identical to files-only.
- `userEmail`: optional; reserved for the planned Supabase per-user lookup.
- Combined email input is length-capped (16000) before the API call; the assembled system
  prompt is capped (32000). Failure branches return `{ error, detail? }` with an appropriate
  status (401 unauthorized, 400 empty body, 500 missing key, 502 Claude error/empty). The prompt
  asks for a concise reply body only — no subject, no preamble.

## How to run / deploy

Local dev is awkward (add-ins need HTTPS); the real target is the VPS. Push auth is set up on
the box (`~/.git-credentials`), so the full loop can live there.

```bash
# 1. edit, verify, commit, push (this repo, real remote — confirm the push lands on GitHub)
node --check server/index.js
git add -A && git commit -m "..." && git push origin main

# 2. on the VPS (ssh root@87.99.145.62):
cd ~/app && git pull && docker compose up -d --build   # use `up -d` (not just build) when volumes/mounts change

# 3. verify:
curl -s https://reply-devon.duckdns.org/health   # -> {"status":"ok",...,"keyConfigured":true}
```

- Static Outlook changes (`taskpane.html/css`): reopen the pane in Outlook (hard refresh).
- Manifest changes: bump `<Version>`, then remove + re-add the add-in (`aka.ms/olksideload`).
- `prompt/` + `kb/` are mounted volumes: edits take effect on the next request, no rebuild.
- Gmail add-on: `cd gmail-addon && clasp push`; Google-side setup per `gmail-addon/README.md`.

## Repo hygiene — learned the hard way

1. One repo, one source of truth. No parallel repos, no remote-less sandboxes.
2. "Committed" ≠ "saved." Confirm changes reach GitHub `main` (`git ls-remote origin main`).
3. Deploy from the remote (`git pull` on the VPS), never from hand-copied local files.
4. Keep the docs canonical: `CLAUDE.md` + `docs/project-scope.md` are the source of truth;
   reconcile, don't fork.

## Note on this Claude Code (web) session

This session develops on the branch `claude/reply-drafter-demo-tycclb` and pushes there, not
directly to `main` — merge that branch to `main` to deploy. The VPS pulls `main`.
