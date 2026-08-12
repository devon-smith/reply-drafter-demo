# Reply Drafter — backend API

The backend (`server/index.js`) exposes a tiny HTTP surface on
`https://reply-devon.duckdns.org`. Both mail clients (Outlook pane, Gmail add-on)
and the dashboard talk to it. Auth, when `API_SECRET` is set, is: **same-origin
(the served Outlook pane) OR a matching `x-api-key` header (the Gmail add-on)**.
If `API_SECRET` is unset, everything is allowed (dev/default).

All request/response bodies are JSON.

---

## `GET /health`

Liveness + config probe. No auth.

```json
{ "status": "ok", "model": "claude-sonnet-4-6", "keyConfigured": true, "supabaseConfigured": true }
```

---

## `POST /draft`

Generate one editable reply body. This is the core endpoint; **v2 only ADDS
optional fields — every pre-v2 payload behaves byte-for-byte as before.**

### Request

| field             | type   | req? | notes |
|-------------------|--------|------|-------|
| `body`            | string | yes  | the incoming message, incl. quoted thread history. Capped at 16000 chars combined with from/subject. |
| `from`            | string | no   | sender header, for context |
| `subject`         | string | no   | subject, for context |
| `userEmail`       | string | no   | drives the per-user Supabase lookup (KB + prompt/tone) |
| `overrides`       | object | no   | `{ systemPromptAppend?, kb?, tone? }` — fallback config used only when the user has no Supabase rows |
| `userInstruction` | string | no   | **v1** per-reply steer ("How should I reply?"). Still honored. |
| `steer_text`      | string | no   | **v2** free-text steer (free-text chip / footer). Highest-precedence steer source. |
| `steer_preset_id` | string | no   | **v2** id of a static catalog chip (`server/steerCatalog.js`); the server resolves the authoritative steer text. |
| `steer_source`    | string | no   | **v2** analytics tag: `static_chip` \| `smart_chip` \| `saved_steer` \| `free_text` \| `legacy`. Inferred if omitted. |
| `tone_override`   | string | no   | **v2** one-off tone for this reply only; layered over saved tone, not persisted. Capped 200 chars. |
| `length`          | string | no   | **v2** `short` \| `medium` \| `long` soft length nudge. |

**Steer precedence** (only one becomes the active instruction, highest first):
`steer_text` → `steer_preset_id` → `userInstruction`. With none present the draft
is identical to pre-v2 output.

### Response

`200` → `{ "reply": "…reply body only…" }`

Errors: `401` unauthorized · `400` empty body · `500` missing key / server error
· `502` Claude error or empty completion · `429` rate limit or daily cap reached
(`{ "error": "…" }`). Clients surface `error` verbatim.

---

## `POST /suggest` (v2)

Given an open message, return up to **three** contextual reply-intent chips for
the panel. **Fail-safe by construction:** apart from an auth rejection it ALWAYS
returns `200` with a usable `chips` array — the static catalog whenever the model
is slow, over budget, disabled, or errors. The panel never blocks on it.

### Request

| field       | type   | req? | notes |
|-------------|--------|------|-------|
| `body`      | string | yes* | the incoming message. *Empty body → static chips, still `200`. |
| `from`      | string | no   | context |
| `subject`   | string | no   | context |
| `userEmail` | string | no   | for the suggest daily-cap + cache key |

### Response

```json
{
  "source": "smart",              // "smart" = model-classified · "static" = fallback catalog
  "cached": true,                 // present only on an LRU cache hit
  "chips": [
    { "id": "smart_0", "label": "Propose a time",
      "steer_text": "Express interest and move toward scheduling…",
      "source": "smart_chip" }
  ]
}
```

- `label` ≤ 3 words. `steer_text` is one imperative sentence (capped 2000 chars).
- **Static chips** carry a catalog `id` (`quick_thanks`, `propose_time`, …) and
  `source:"static_chip"`; a client may send them back as `steer_preset_id`.
- **Smart chips** carry a synthetic id and `source:"smart_chip"`; a client sends
  them back as `steer_text` + `steer_source:"smart_chip"`.

### Guardrails (all silent → static fallback)

- Hard **server-side deadline** `SUGGEST_TIMEOUT_MS` (default 2500 ms) via
  `AbortController` — `UrlFetchApp` has no per-call timeout, so the deadline MUST
  live here.
- Separate suggest rate bucket + `SUGGEST_DAILY_TOKEN_CAP` (default 200000),
  decoupled from the drafting budget.
- In-memory LRU (`SUGGEST_LRU_TTL_S`, default 3600 s) keyed by user + content.
- Metered to `usage_event` with `kind='suggest'` (Haiku pricing).

### Config (env, all optional)

| var | default | meaning |
|-----|---------|---------|
| `SUGGEST_MODEL` | `claude-haiku-4-5-20251001` | classifier model |
| `SUGGEST_TIMEOUT_MS` | `2500` | hard deadline for the classify call |
| `SUGGEST_DAILY_TOKEN_CAP` | `200000` | per-user/day suggest token cap |
| `SUGGEST_LRU_TTL_S` | `3600` | suggestion cache TTL |
| `SUGGEST_PRICE_INPUT_PER_MTOK` / `SUGGEST_PRICE_OUTPUT_PER_MTOK` | `1` / `5` | Haiku pricing for metering |

---

## `usage_event` columns (v2)

Migration `0008` adds:

- `kind` — `draft` (default) or `suggest`. The drafting daily cap counts only
  `kind='draft'`; suggest has its own cap.
- `steer_source` — how a draft was steered (see the `/draft` table); null on
  suggest and pre-v2 rows.

## Static pages

`GET /privacy`, `GET /terms`, `GET /support` — served from the repo-root HTML.
