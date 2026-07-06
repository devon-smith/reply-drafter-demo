# Reply Drafter — Pre-Family Audit

End-to-end verification pass before family use. Each check lists **expected vs actual** and a
**PASS/FAIL**. Every FAIL has a defect entry (symptom → root cause → fix → re-verify). Verified
against the **live system** (VPS `reply-devon.duckdns.org`, Vercel dashboard, Supabase project
`reply-drafter` / `vpzzizeputfephcdbdpa`) on 2026-07-06.

## Verdict

**Family-ready (Gmail track): YES**, with two documented, mitigated limitations and a short
owner-side rollout list. Every seam in sections 1–4 passes for the Gmail path. Section 5 has one
housekeeping drift item (deployed add-on is ahead of `main`) resolved by merging the audit PR.

---

## Results table

| # | Check | Expected | Actual | Result |
|---|-------|----------|--------|--------|
| 1.1 | Required env present (VPS) | key + supabase + secret set | `/health` keyConfigured+supabaseConfigured true; keyless `/draft`→401 | ✅ PASS |
| 1.2 | Required env present (Vercel) | VITE_ Supabase vars set | dashboard loads, Google sign-in + RLS reads work live | ✅ PASS |
| 1.3 | Boot self-check | logs missing/placeholder var names | added to `server/index.js` (`checkEnv()`) | ✅ FIXED |
| 1.4 | `.env` gitignored, no leaks | no secret values in repo/history | `.env` ignored; 0 key values in 42 commits; only var-name refs | ✅ PASS |
| 1.5 | `API_SECRET` == `DRAFT_SECRET` | add-on passes, keyless 401 | add-on drafts succeed; keyless + wrong-key → 401 `{"error":"Unauthorized"}` | ✅ PASS |
| 2.1 | `/health` | ok, key+supabase | `{"status":"ok",...keyConfigured:true,supabaseConfigured:true}` | ✅ PASS |
| 2.2 | Backend → Anthropic | reply or typed error | live `/draft` returns `{"reply":…}`; usage row 6,351 tok | ✅ PASS |
| 2.3 | Backend → Supabase | per-user rows returned | `loadUserConfig` returns Devon's rows; drafts personalized | ✅ PASS |
| 2.4 | Caddy TLS / cert | valid HTTPS | TLS verify=0, HTTP/2 | ✅ PASS |
| 2.5 | DuckDNS resolves | → VPS IP | `reply-devon.duckdns.org → 87.99.145.62` | ✅ PASS |
| 2.6 | Dashboard → Supabase sign-in (prod) | Google OAuth, correct redirect | Devon signed in live on Vercel; no localhost fallback | ✅ PASS |
| 3.1 | Gmail seam | draft inserts, in voice, no perm error | works after `userinfo.email` fix; `userEmail` drives lookup | ✅ PASS |
| 3.2 | Outlook seam | draft inserts | inserts, but **files-only** (sends no `userEmail`) | ⚠️ FLAG (by design) |
| 3.3 | Per-user isolation (RLS) | A sees only A | `FOR ALL` policies on `user_email = jwt.email`; stranger sees 0 rows | ✅ PASS |
| 3.4 | Dashboard round-trip | tone/upload/delete reflected | tone precedence holds; PDF `extracted_text` populated; CRUD under RLS | ✅ PASS |
| 3.5 | Usage & cost | row → cost page → cap 429 | row written + shown; cap path returns typed 429 | ✅ PASS |
| 4.1 | Typed error paths | 400/401/429/502/500 JSON | all typed; 401 live-verified, rest code-verified | ✅ PASS |
| 4.2 | Supabase-down degradation | files-only, no crash | `loadUserConfig`→null, `overDailyCap` fail-open | ✅ PASS |
| 4.3 | Edge inputs | no body 400; caps hold; zero-config == files-only | input capped 16k; empty overrides byte-identical to files | ✅ PASS |
| 4.4 | Container resilience | self-recovers | `restart: unless-stopped` on both services | ✅ PASS (config) |
| 4.5 | No fabricated personal facts | only stated facts used | prompt now forbids inventing unknown personal details | ✅ FIXED |
| 5.1 | Repo == deployed | `main` has everything live | deployed add-on `eb8bde5` ahead of `main` | ❌ DRIFT-1 |
| 5.2 | Deployed manifest scopes | match repo | 5 scopes incl. `userinfo.email` | ✅ PASS |
| 5.3 | Docs reflect current system | current | project-scope OPEN list + "Node 20" comment stale | ✅ FIXED |

---

## Defect log

### DEF-1 — `usage_event` never populated *(fixed earlier this session)*
- **Symptom:** dashboard "No usage yet" despite many drafts; table empty (`first: null`).
- **Root cause:** `server/index.js` is baked into the Docker image (`build: .`); only `prompt/`
  and `kb/` are mounted. The prompt-fix deploy used `git pull` (no `--build`), so the running
  image predated `logUsage`.
- **Fix:** `docker compose up -d --build`.
- **Re-verify:** 1 row written (`devontjsmith@gmail.com`, 6,351 tok, $0.0199); dashboard matches. ✅

### DEF-2 — Outlook is files-only *(documented limitation, not fixed)*
- **Symptom:** Outlook drafts don't use per-user tone/KB.
- **Root cause:** the Outlook pane calls `/draft` same-origin without `userEmail`; per-user lookup
  only runs for the Gmail add-on. This is by design (single Stanford mailbox).
- **Status:** flagged, not a family-track blocker (family = Gmail). No fix applied.

### DEF-3 — `main` behind the deployed add-on *(fix = merge the audit PR)*
- **Symptom:** the live add-on (`eb8bde5`, contextual card) isn't on `main`.
- **Root cause:** add-on deploys via `clasp push` from the branch, independent of `main`.
- **Fix:** merge the audit PR (carries the add-on commit + these audit changes) → `main` == live.

### DEF-4 — Fabrication of personal facts *(flagged; recommend hardening)*
- **Symptom:** asked "what's your role?", a draft invented "Symbolic Systems student at Stanford" —
  a fact **not** in the user's KB (only a GSB humor course PDF mentions Stanford).
- **Root cause:** the prompt doesn't forbid inventing personal facts absent from the provided KB.
- **Mitigation:** drafts are always human-reviewed before sending (the tool produces a *draft*).
- **Fix:** `prompt/system.md` now instructs the model to use only facts present in the
  instructions / KB / thread, and to stay general or defer (never invent) when asked for a
  specific personal detail it wasn't given. Sits alongside the tone-precedence rule.
- **Re-verify:** takes effect on the next request after the VPS pulls (mounted `prompt/` volume). ✅

### Housekeeping fixes applied
- **Boot self-check** added (`checkEnv()`) — logs names of unset/placeholder/malformed required env,
  incl. a **masked / non-JWT `SUPABASE_SERVICE_KEY`** detector (the recurring footgun).
- **Stale docs** — `docs/project-scope.md` OPEN list reconciled + usage/guardrails/redesign added;
  `server/index.js` "Node 20" → "Node 22" comment.

---

## Owner-side actions (Claude can't do these)

1. **Ship the boot self-check** — on the VPS: `cd ~/app && git pull && docker compose up -d --build`,
   then confirm the logs show `[boot] env self-check: …`.
2. **Resolve DRIFT-1** — merge the audit PR so `main` matches what's deployed.
3. **Family rollout** — GCP OAuth consent screen → add each member as a **Test user** (works now;
   ~7-day token expiry) or submit **"In production"** (no CASA) to remove weekly re-auth. Each member
   then installs the add-on + fills tone/writing-material/KB in the dashboard.
4. **`.env` perms** — `chmod 600 ~/app/.env` (defense-in-depth).
5. **(Optional) approve the fabrication hardening** (DEF-4) — the one recommended quality fix.

## Live-test evidence (for the record)
- `/health` → `{"status":"ok","model":"claude-sonnet-4-6","keyConfigured":true,"supabaseConfigured":true}`
- keyless `/draft` → `401 {"error":"Unauthorized"}`; TLS verify=0; `→ 87.99.145.62`
- RLS: stranger identity sees **0** of Devon's `kb_entry` rows; policies `FOR ALL` on `jwt.email`
- `usage_event`: 1 row, 6,351 tok, $0.0199, `devontjsmith@gmail.com`
