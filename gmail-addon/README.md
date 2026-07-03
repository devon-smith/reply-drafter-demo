# Family Reply Drafter — Gmail add-on

A Gmail Workspace add-on (Google Apps Script + CardService) that drafts replies
with Claude by calling the same `/draft` backend the Outlook add-in uses. Open an
email → **Generate reply** → an editable draft reply opens, pre-filled by Claude.

It uses only **add-on-scoped** Gmail scopes (not the broad restricted Gmail
scopes), so it never triggers Google's CASA / third-party security assessment.
At family scale (2–10 users) each personal `@gmail.com` user just clicks through a
one-time "unverified app" screen.

## Files

| File | Purpose |
|------|---------|
| `appsscript.json` | Manifest: 4 OAuth scopes, contextual trigger, homepage trigger |
| `Code.gs` | Triggers + cards; reads message/thread; returns the editable draft reply |
| `Backend.gs` | `UrlFetchApp` POST to `/draft` with an `X-Api-Key` header |
| `Settings.gs` | Per-user tone/prompt/KB overrides in `UserProperties` (Option B) |
| `.clasp.json.example` | Template — copy to `.clasp.json` (gitignored) with your script ID |

The design/scope for this track lives in [`../docs/gmail-addon.md`](../docs/gmail-addon.md).

## One-time setup

Everything below runs on **your** machine + Google account — none of it can be
done from a code sandbox.

1. **Prerequisites**
   ```bash
   node -v            # >= 20
   npm i -g @google/clasp
   clasp login        # opens a browser once; writes ~/.clasprc.json (never commit)
   ```
   Enable the Apps Script API: https://script.google.com/home/usersettings

2. **Create (or link) the Apps Script project** from this directory:
   ```bash
   cd gmail-addon
   clasp create --type standalone --title "Family Reply Drafter" --rootDir .
   # this writes .clasp.json (gitignored). Or, if the project already exists:
   #   cp .clasp.json.example .clasp.json   # then paste the scriptId
   clasp push
   ```

3. **Set backend config** in Script Properties (Apps Script editor →
   Project Settings → Script Properties), or via the editor:
   - `DRAFT_URL` = `https://reply-devon.duckdns.org/draft`
   - `DRAFT_SECRET` = a long random string (also add it to the backend once the
     `X-Api-Key` check ships — see `docs/gmail-addon.md`, Phase 0)

4. **Install for yourself** (development): Apps Script editor →
   **Deploy → Test deployments → Install**. Open Gmail, open a message, and the
   **Reply Drafter** card appears.

## Roll out to family (still unverified, no Google review)

1. Link the project to a standard **GCP project** (the default one can't publish).
2. Configure the **OAuth consent screen** (User type: **External**).
3. **Set publishing status to "In production"** — this is the key gotcha. In
   "Testing" status, test-user grants expire after **7 days**; "In production"
   (still unverified) avoids constant re-consent.
4. Add each family member's exact Google email as a **Test user**.
5. Each person installs the test deployment and clicks through the one-time
   **"This app isn't verified"** screen (Advanced → Go to app → Allow).

Notes:
- Unverified apps requesting sensitive scopes have a **100-user lifetime cap**
  (per project, **cannot be reset**) — irrelevant at family scale, but don't burn
  it with throwaway multi-account testing.
- Consumer `@gmail.com` UrlFetch quota is 20,000 calls/day — enormous headroom.

## Daily dev loop

```bash
cd gmail-addon
# edit .gs / appsscript.json
git commit -am "..."
clasp push          # or: clasp push --watch
# refresh Gmail to test (no redeploy needed for head/test deployments)
```

**Golden rule:** edit in git *or* the web editor, not both — `clasp push`
overwrites the remote, `clasp pull` overwrites local.

## Not included (by design)

- **Compose-trigger insert.** The compose trigger event exposes only recipient
  metadata (to/cc/bcc), not the draft's subject/body, so it can't see what you
  already typed. The reliable path is `createDraftReply` from the message-reading
  card, which this add-on uses. Add a compose trigger later only if needed.
- **Backend override handling.** `Settings.gs` already sends `overrides` in the
  request body; the backend ignores unknown fields until Phase 0 adds support.
