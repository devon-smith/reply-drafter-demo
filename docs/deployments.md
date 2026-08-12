# Reply Drafter — deployment map

Where each surface runs, how a change reaches it, and the v2-relevant gotchas.
Canonical plan is `docs/project-scope.md`; this file is the operational cheat sheet.

## The three surfaces + one backend

| Surface | Runs on | Deploy trigger | Notes |
|---------|---------|----------------|-------|
| Backend (`server/`) | Hetzner VPS `reply-devon.duckdns.org` behind Caddy | `git pull` on the VPS, then `docker compose up -d --build` | Server code is **baked into the image** — a rebuild is required for `server/**` changes. `prompt/` + `kb/` are mounted volumes (pull only, no rebuild). |
| Outlook add-in (`taskpane.*`, `manifest.xml`) | Served static from the VPS | same `git pull` (static) | Manifest changes need a `<Version>` bump + re-sideload. |
| Gmail add-on (`gmail-addon/`) | Google Apps Script | `clasp push` from `gmail-addon/`, then version the deployment | Holds no secrets except `DRAFT_SECRET` in Script Properties. |
| Dashboard (`dashboard/`) | Vercel `reply-drafter-demo.vercel.app` | Vercel auto-builds `main` | SPA; talks to Supabase (anon key) + `/draft`. |

Branch → main → deploy: work lands on `claude/reply-drafter-demo-tycclb`, merges to
`main`; the VPS pulls `main`, Vercel builds `main`.

## Backend deploy (v2)

```bash
# on the VPS (ssh root@87.99.145.62):
cd ~/app && git pull && docker compose up -d --build
curl -s https://reply-devon.duckdns.org/health          # {status:ok, ...}
# smoke the new endpoint — must ALWAYS 200 with chips, even without a live model:
curl -s -X POST https://reply-devon.duckdns.org/suggest \
  -H 'content-type: application/json' -H "x-api-key: $API_SECRET" \
  -d '{"from":"a@b.com","subject":"Lunch?","body":"Grab lunch Thursday?"}'
```

**v2 needs the Supabase migration applied** (`supabase/migrations/0008_*`,
`0009_*`) before the new columns/tables exist. Apply via the Supabase migration
flow (build-time), not from the running backend. New env is all optional
(`SUGGEST_*`) — the boot self-check echoes the resolved values in the container log.

## Gmail add-on deploy

- **scriptId:** `1aP1S93FqRD1EnPxagvxZiIuk7px47nZa1i3en8p-po9QU04HG52ZoxGa`
  (put in `gmail-addon/.clasp.json`, gitignored).
- **HEAD / test deployment:** `clasp push` updates the code; installed test users
  see it on the next Gmail refresh — no re-version needed. This is the family
  rollout channel today (unverified, "In production").
- **Promote a numbered deployment** (only if a versioned deployment is used):
  ```bash
  cd gmail-addon && clasp push -f
  clasp deploy --description "v2 smart steer chips"   # new versioned deployment
  ```
- **No new OAuth scopes in v2** — the card redesign, chips, and `/suggest` all
  reuse the existing scopes, so no re-consent and no new Marketplace review. Do
  NOT touch `appsscript.json` `oauthScopes` or the consent screen.

## Confirmed behaviors (so v2 matches v1)

- **Reply, not reply-all.** `Code.gs` uses `msg.createDraftReply(reply)` — a reply
  to the sender, not `createDraftReplyAll`. v2 chips keep this exact behavior;
  the chip only changes *what the draft says*, never the recipient set.
- **Compose actions carry form inputs.** `e.commonEventObject.formInputs` is
  populated on the `REPLY_AS_DRAFT` compose action, so chip selections / free-text
  steer ride along on the same click that opens the draft. (An `onChangeAction`
  handler previously broke card render — do not reintroduce one.)
- **The model call is on the button/chip tap, never on open** (contextual triggers
  fire on every message open). `/suggest` is the one exception, and it is capped,
  cached, and fail-safe so an open never blocks or burns budget.

## v2 cost review (smart chips)

The new per-open cost is the `/suggest` Haiku classification. Ballpark, at the
default `$1 / $5` per-Mtok Haiku pricing:

- Typical email: ~250-token system + ~500-token email in, ~100 tokens out ≈
  **$0.0009/open**. Worst case (a full 16k-char email) ≈ **$0.0045/open** — under
  the ≤$0.005/open target.
- The server **LRU cache** collapses repeat opens of the same message to $0, and
  contextual triggers reopen the same messages often, so the *effective* per-open
  cost is well below the per-call figure.
- `SUGGEST_DAILY_TOKEN_CAP` (default 200000 tok/user/day ≈ a few hundred opens)
  bounds the daily worst case to well under ~$0.25/user/day; past the cap the
  panel silently serves the static catalog.
- Drafting cost is unchanged (still Sonnet, on tap). `usage_event.kind` splits the
  two so the dashboard shows suggest spend separately.

**Kill switch:** set the add-on Script Property `SUGGEST_ENABLED='false'` to stop
all per-open classification instantly (no redeploy) — the panel then shows the
instant static catalog and sends nothing on open. The `/privacy` policy documents
this behavior and the on-open classification.

## v2 rollout checklist (owner-side)

1. Apply migrations `0008` + `0009` (Supabase) before deploying the backend.
2. VPS: `git pull && docker compose up -d --build`; check `/health` and smoke
   `/suggest` (must 200 with chips). Confirm the boot log's `[boot] suggest:` line.
3. `cd gmail-addon && clasp push` (HEAD deployment — family sees it on refresh).
   Optionally set `SUGGEST_ENABLED` in Script Properties (default on).
4. Vercel auto-deploys the dashboard from `main` (Saved steers tab + usage split).
5. Regression: verify the **Outlook** pane still drafts (its `/draft` payload is
   unchanged) and a plain Gmail "Generate reply" with no chip still works.
6. New Marketplace screenshots showing the chips (listing content only — no scope
   change, so no new review).
