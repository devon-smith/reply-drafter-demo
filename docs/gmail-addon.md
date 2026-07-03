# Gmail family-use add-on — scope & plan

> Companion track to the Outlook add-in. This documents a deliberate scope
> change: earlier planning notes listed **Gmail as excluded**; we are now
> building a small, private Gmail add-on so a handful of family members (2–10
> users) can draft replies with Claude. This does **not** replace the Outlook
> work — both share the same `/draft` backend.

## Why this is light

The Outlook loop maps almost 1:1 onto a Gmail Workspace add-on (Apps Script +
CardService). A contextual (message-open) trigger reads the open message and full
thread; a card button POSTs to the existing VPS `/draft` endpoint via
`UrlFetchApp`; the response is inserted as an editable draft reply. The Anthropic
key stays server-side exactly as today. No Microsoft Graph analog is needed —
`GmailApp` + the event's temporary access token cover all message/thread reads.

## The CASA-avoidance decision (the crux)

The add-on uses only **add-on-scoped** Gmail scopes plus a non-sensitive external
-request scope:

| Scope | Class |
|-------|-------|
| `gmail.addons.execute` | low sensitivity, not restricted |
| `gmail.addons.current.message.readonly` | sensitive, **not restricted** |
| `gmail.addons.current.action.compose` | sensitive, **not restricted** |
| `script.external_request` | non-sensitive (enables `UrlFetchApp`) |

Google's CASA / third-party security assessment is triggered only by **restricted**
scopes (`gmail.readonly`, `gmail.modify`, `gmail.compose`, `gmail.metadata`,
`https://mail.google.com/`, …) when data is stored/transmitted on servers.
Because we use only add-on scopes, **we never need CASA** — even though email
content flows to the VPS and then to Anthropic. Sensitive scopes only cause a
one-time "unverified app" warning and a 100-user lifetime cap, both irrelevant at
family scale.

**Hard line to stay light:** do NOT add a broad Gmail scope (e.g.
`gmail.readonly` to scan the whole mailbox) — that crosses into restricted
territory and triggers CASA.

## Backend contract (shared with Outlook)

`/draft` stays the source of drafting logic. The add-on sends the existing
`{ from, subject, body }` (body carries quoted thread history, same as Outlook)
plus two optional fields:

```json
{
  "from": "...", "subject": "...", "body": "...(latest + quoted history)...",
  "userEmail": "someone@gmail.com",
  "overrides": { "tone": "...", "systemPromptAppend": "...", "kb": "..." }
}
```

The backend layers `overrides` on top of its mounted `prompt/system.md` +
`kb/*.md` defaults, falling back to those defaults when a field is absent.
Unknown fields are ignored, so the current single-user Outlook behavior keeps
working unchanged.

## Authenticating the add-on to the backend

Shared secret: a long random string stored in Apps Script **Script Properties**
(`DRAFT_SECRET`), sent as an `X-Api-Key` header, checked by Express with a
constant-time compare. Script Properties are project-scoped and the code runs on
Google's servers, so the secret is never exposed to end users; Caddy's HTTPS
keeps it encrypted in transit.

**Coexistence caveat:** the deployed Outlook pane calls `/draft` same-origin with
**no** secret header. So the `X-Api-Key` check must be introduced
backward-compatibly (e.g. required only for cross-origin callers, or the secret
added to the Outlook pane too) — a mandatory check would break the live Outlook
add-in.

## Privacy note (for the family)

Opening the add-on sends the thread to the VPS and to Anthropic. Mitigations:
Anthropic does not train on API data and auto-deletes API inputs/outputs after 7
days; the VPS logs metadata only (no full bodies), keeps the key in an env file
outside git, and is firewalled with key-only SSH.

## Phased plan

- **Phase 0 — Backend hardening (½ day).** `X-Api-Key` middleware (backward
  -compatible with the Outlook same-origin path), HTTPS-only, and `overrides`
  pass-through layered on the mounted-file defaults. Fully backward-compatible.
- **Phase 1 — Minimal add-on (done: scaffold).** `gmail-addon/` clasp project;
  4 scopes; contextual trigger reads message/thread; **Generate reply** button
  calls `/draft` and inserts via `createDraftReply` + `ComposeActionResponse`.
- **Phase 2 — Per-user settings (scaffolded).** `Settings.gs` stores tone/prompt
  /KB in `UserProperties` and sends them as `overrides`. Zero backend storage.
- **Phase 3 — Roll out to family (½ day, yours).** Standard GCP project; OAuth
  consent screen (External); publishing status **In production** (avoids 7-day
  re-consent); add family emails as test users; walk each through the one-time
  unverified-app warning.
- **Phase 4 (only if needed) — Web dashboard + SQLite** for a nicer KB editor;
  backend looks up per-user config by ID while the add-on still sends lightweight
  overrides.

## Thresholds that change the plan

- Approaching ~100 users, or wanting to remove the warning screen →
  sensitive-scope OAuth verification (consent-screen/brand review, ~3–10 days;
  still **not** CASA).
- Adding a broad Gmail scope → crosses into restricted territory → CASA.
- KB outgrows `UserProperties` string limits → graduate to the SQLite dashboard.

## Current status

`gmail-addon/` is scaffolded (manifest, `Code.gs`, `Backend.gs`, `Settings.gs`,
clasp config template, setup runbook). Not yet pushed to Apps Script or wired to
Google — that's Phase 3, which runs on your machine + Google account. Backend
Phase 0 (overrides + auth) is **not yet built**.
