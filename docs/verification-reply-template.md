# OAuth Verification Reply - Email Template

Use this as the reply to Google's Trust & Safety / OAuth verification team.
The demo video (see docs/verification-video-script.md) is recorded and its link
is filled in below.

---

**Subject:** Reply Drafter - OAuth verification scope justification + demo video

Hello,

Thank you for reviewing Reply Drafter. Below is our app description, a
justification for each requested scope, and a demo video showing the complete
flow and every scope in use.

## Updates made in response to your checklist

In response to your verification checklist, we have updated our privacy policy
(hosted at https://www.reply-drafter.com/privacy, with the Limited Use
compliance statement also shown on the landing page at
https://www.reply-drafter.com):

- Added the Google API Services Limited Use affirmative statement: "Reply
  Drafter's use of information received from Google APIs will adhere to the
  Google API Services User Data Policy, including the Limited Use requirements."
- Added five explicit, individually-labeled data-handling disclosures: Data
  Access, Data Use, Data Transfer, Data Protection, and Data Retention &
  Deletion.
- Added an AI/ML training restriction statement: Gmail™ message content sent to
  Anthropic's API is not used to train or improve any AI/ML model (Anthropic
  does not train on API inputs by default), and Google Workspace user data is
  never used to develop, improve, or train any model beyond generating that
  user's own draft reply.

## App description

Reply Drafter is a small, self-hosted Gmail add-on that helps a person draft
email replies in their own voice using Anthropic's Claude. A user opens an
email, clicks Generate reply, and an editable draft appears in Gmail for them
to review and send themselves - the add-on never sends mail on its own. Each
user tunes their own tone and writing style from a companion web dashboard,
and settings are private to that user. This is a small personal/family tool
used by a handful of people, not a large-scale commercial product.

## Per-scope justification

**https://www.googleapis.com/auth/gmail.addons.execute**
Required for the app to run as a Gmail add-on at all. It lets our CardService
add-on render its panel and respond to the user's clicks inside Gmail. It
grants no access to mail content on its own; it is the baseline execution
scope every Gmail add-on must declare.

**https://www.googleapis.com/auth/gmail.addons.current.message.readonly**
When the user opens an email and clicks "Generate reply," we read the content
of that single open message and its quoted thread history so the drafted
reply is relevant and in-context. This scope is limited to the message the
user is currently viewing - we do not and cannot scan the inbox or read other
messages. The content is used only to generate that one reply.

**https://www.googleapis.com/auth/gmail.addons.current.action.compose**
We use this to place the generated reply into a standard Gmail draft that
opens for the user to review and edit. This is how the drafted text reaches
the user. The scope allows composing a draft only; the add-on never sends
email - the user sends it themselves.

**https://www.googleapis.com/auth/script.external_request**
The add-on calls our own backend (over HTTPS) to generate the reply. The
backend assembles the user's settings and forwards the request to Anthropic's
Claude API, then returns the drafted text. This scope (UrlFetchApp) is
required to make that outbound request; without it the add-on cannot reach
the model that produces the draft.

**https://www.googleapis.com/auth/userinfo.email**
We read only the user's email address to load that user's own saved settings
(tone, knowledge base, writing samples) so drafts sound like them, and to
attribute usage for per-user cost limits. We do not read the user's name,
profile, or any other account information, and the address is not shared.

## Scope tier

All five scopes above are sensitive scopes. Reply Drafter does not request
any restricted scopes, so no CASA (Cloud Application Security Assessment) is
required for this submission.

## Test access

No special test credentials are needed to review this app. The add-on
installs directly into the reviewer's own Google account, and the companion
web dashboard authenticates using the reviewer's normal Google sign-in - there
is no separate test login or password to provision.

If your team uses an automated or manual tester account, please note that
gsmtestuser@marketplacetest.net is not blocked and is free to install and use
the add-on and dashboard.

## Demo video

A short (~3-4 minute) screen recording showing installation and consent,
and each of the five scopes in use end-to-end, is available here:

https://www.youtube.com/watch?v=Pwe-vsYd_9U

## Checklist confirmations

- CASA: Not applicable. Reply Drafter requests sensitive scopes only and no
  restricted scopes, so no third-party (CASA) security assessment is required.
- Test credentials: None required. The add-on installs into the reviewer's own
  Google account, and the companion dashboard uses the reviewer's own Google
  sign-in - there is no separate login or password to provision.
- Authentication blockers: None. There are no phone-number verifications, credit
  card requirements, or other constraints blocking access to the integration.
- Data Portability APIs: Not used by this application.
- Publishing status: Remains "In Production."
- Demo video: Unlisted on YouTube at
  https://www.youtube.com/watch?v=Pwe-vsYd_9U, showing the OAuth consent screen
  with all requested scopes fully expanded and each scope exercised end-to-end.

Please let us know if any additional information is needed.

Thank you,
Devon Smith
