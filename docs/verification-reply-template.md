# OAuth verification — reply to Google's review team

Paste-ready reply for the Google Workspace Marketplace / OAuth verification review
(`gwm-review@google.com`). Keep the reviewer's subject line. Video link and URLs are filled in.

Related: `docs/marketplace-listing.md` (per-scope justifications), `docs/marketplace-publish.md`
(the publish + verification runbook).

---

## Reply email (to `gwm-review@google.com`, keep their subject line)

> Hello,
>
> Thanks for opening the review. Requested materials below.
>
> **Screen recording (full workflow, each scope demonstrated):**
> https://www.youtube.com/watch?v=Pwe-vsYd_9U
>
> **Testing credentials:** None required. The add-on installs into the reviewer's own Google account
> and works with any signed-in account. The companion settings dashboard also uses Google sign-in with
> the reviewer's own account. The test account `gsmtestuser@marketplacetest.net` is **not blocked** —
> the app has no per-user allowlist and works for any Google account; an account with no saved settings
> simply gets sensible defaults.
>
> **How to test:** After installing, open any email in Gmail, click the **Reply Drafter** icon in the
> right-side panel, then **Generate reply** — an editable draft reply appears in a compose window
> (nothing is sent automatically). To customize tone/voice, sign in at https://www.reply-drafter.com
> with the same account.
>
> **Scope usage:**
> - `gmail.addons.execute` — runs the add-on and renders its panel in Gmail.
> - `gmail.addons.current.message.readonly` — reads the currently open message + thread to draft a
>   relevant reply (only the open message; no inbox scanning).
> - `gmail.addons.current.action.compose` — places the generated reply into an editable draft; cannot
>   send mail.
> - `script.external_request` — calls our backend, which forwards to the AI model to generate the reply.
> - `userinfo.email` — reads only the signed-in email address to load that user's own settings.
>
> **Privacy policy:** https://www.reply-drafter.com/privacy
> **Terms of service:** https://www.reply-drafter.com/terms
> **Support:** https://www.reply-drafter.com/support
> **Contact:** devonthomassmith@gmail.com
>
> Happy to provide anything else needed.
> Thanks,
> Devon

---

## Video → scope map (what the recording demonstrates)

| In the video | Scope shown |
|---|---|
| Install → OAuth consent → Allow | `gmail.addons.execute` (add-on runs) |
| Open an email; the card reads it ("Replying to …") | `gmail.addons.current.message.readonly` |
| Click Generate reply → backend call | `script.external_request` |
| Editable draft opens in compose | `gmail.addons.current.action.compose` |
| Dashboard sign-in loads the user's settings | `userinfo.email` |

Video: https://www.youtube.com/watch?v=Pwe-vsYd_9U
