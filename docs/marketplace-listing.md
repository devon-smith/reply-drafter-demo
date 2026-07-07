# Reply Drafter — Google Workspace Marketplace listing content

Copy-paste source for the **Marketplace SDK → Store Listing** and the **OAuth consent screen**.
Written to match the real system (see `CLAUDE.md`). Keep it honest: this is a small personal/family
tool, not a commercial product — reviewers respond better to an accurate small-scale description than
to inflated claims.

Related: `docs/marketplace-publish.md` (the step-by-step runbook), `privacy.html` (`/privacy`),
`terms.html` (`/terms`).

---

## App identity

- **App name:** Reply Drafter
- **Short description** (~28 words):
  > Draft a Gmail reply in your own voice with Claude. Open an email, click Generate, and an editable
  > draft appears — you review and send it yourself. Nothing is sent automatically.

- **Long description:**
  > Reply Drafter helps you get through your inbox faster by drafting replies that sound like you.
  > Open an email in Gmail, click **Generate reply**, and it reads that message (and its thread) and
  > produces a ready-to-edit draft using Anthropic's Claude. You always review and send the draft
  > yourself — the add-on never sends mail on your behalf.
  >
  > Each person tunes their own voice from a simple web dashboard: set your tone, add a few facts
  > (name, sign-off, context), and upload past emails or writing samples so drafts match how you
  > actually write. Your settings are private to you.
  >
  > This is a small, self-hosted tool built for personal and family use — a handful of people, not a
  > large-scale service. It uses only the minimal Gmail add-on permissions needed to read the message
  > you have open and to open a draft reply; it does not scan your inbox or send email for you.

## Categorization

- **Primary category:** Productivity
- **Alternate:** Communication
- **Pricing:** Free

## Developer / support fields

| Field | Value |
|-------|-------|
| Developer name | Devon Smith |
| Support email | devonthomassmith@gmail.com |
| Developer website | https://reply-drafter-demo.vercel.app |
| Privacy policy URL | https://reply-devon.duckdns.org/privacy |
| Terms of service URL | https://reply-devon.duckdns.org/terms |
| Application host | Google Workspace Add-on (Gmail) |

---

## Per-scope justifications (for the OAuth verification "why do you need this scope?")

Each must match what the code actually does. One tight paragraph each; paste into the consent
screen's scope justification fields and the verification form.

**`https://www.googleapis.com/auth/gmail.addons.execute`**
> Required for the app to run as a Gmail add-on at all. It lets our CardService add-on render its
> panel and respond to the user's clicks inside Gmail. It grants no access to mail content on its own;
> it is the baseline execution scope every Gmail add-on must declare.

**`https://www.googleapis.com/auth/gmail.addons.current.message.readonly`**
> When the user opens an email and clicks "Generate reply," we read the content of that single open
> message and its quoted thread history so the drafted reply is relevant and in-context. This scope is
> limited to the message the user is currently viewing — we do not and cannot scan the inbox or read
> other messages. The content is used only to generate that one reply.

**`https://www.googleapis.com/auth/gmail.addons.current.action.compose`**
> We use this to place the generated reply into a standard Gmail draft that opens for the user to
> review and edit. This is how the drafted text reaches the user. The scope allows composing a draft
> only; the add-on never sends email — the user sends it themselves.

**`https://www.googleapis.com/auth/script.external_request`**
> The add-on calls our own backend (over HTTPS) to generate the reply. The backend assembles the
> user's settings and forwards the request to Anthropic's Claude API, then returns the drafted text.
> This scope (UrlFetchApp) is required to make that outbound request; without it the add-on cannot
> reach the model that produces the draft.

**`https://www.googleapis.com/auth/userinfo.email`**
> We read only the user's email address to load that user's own saved settings (tone, knowledge base,
> writing samples) so drafts sound like them, and to attribute usage for per-user cost limits. We do
> not read the user's name, profile, or any other account information, and the address is not shared.

---

## Screenshot shot-list

Capture 2–3 clean screenshots (1280×800 works well). Use a demo email, not anything private.

1. **Gmail — the add-on generating a reply** *(hero shot)*
   - Gmail open on a normal email, Reply Drafter panel on the right showing the branded card
     ("Reply Drafter — Powered by Claude", the "Replying to …" line, and the **Generate reply** button).
   - Ideally capture the state where a drafted reply has just appeared in the Gmail compose window,
     so reviewers see the end result.

2. **Dashboard — Prompt & tone**
   - `reply-drafter-demo.vercel.app`, the dark sidebar console on the **Prompt & tone** tab: the tone
     preset chips + tone field + extra instructions. Shows how a user personalizes their voice.

3. *(optional)* **Dashboard — Usage & cost** or **Writing material**
   - Either the Usage page (tiles + 30-day chart) to show the cost-control story, or the Writing
     material upload to show voice/style personalization. Pick whichever reads most clearly.

**Shot hygiene:** sign in as a demo/owner account, use a fake or innocuous email thread, and make sure
no real personal data, API keys, or other users' names are visible.
