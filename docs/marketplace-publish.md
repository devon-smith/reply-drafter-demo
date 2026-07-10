# Reply Drafter — Marketplace publish + verification runbook

Owner-side, click-by-click. Goal: publish Reply Drafter as an **unlisted** Google Workspace
Marketplace add-on (so anyone with the link installs it in one click, including managed domains their
admin allows), then **submit for OAuth verification** (so the "unverified app" screen disappears and
locked-down domains like Stanford permit it).

Everything here happens in the **Apps Script editor** and the **Google Cloud console** under the same
Google account that owns the script — none of it can be done from the code repo.

Listing text to paste: **`docs/marketplace-listing.md`**.
Legal URLs (already live once the backend is redeployed): `https://reply-devon.duckdns.org/privacy`
and `.../terms`.

> **Legend:** 🟢 **one-time** setup · 🔁 **per-release** (repeat on each new version).

---

## 0. Prerequisites
- The `gmail-addon/` project is pushed (`clasp push`) and works as a test deployment.
- **Redeploy the backend first** so `/privacy` and `/terms` are live (they're new server routes, baked
  into the image): on the VPS `cd ~/app && git pull && docker compose up -d --build`, then check
  `https://reply-devon.duckdns.org/privacy` and `/terms` load over HTTPS. The listing/consent screen
  will reject unreachable URLs.
- Have a square **app icon** ready (PNG, 128×128 and 32×32) and 2–3 **screenshots** (see the shot-list
  in `docs/marketplace-listing.md`).

## 1. 🟢 Link Apps Script to a standard GCP project
A default/hidden GCP project can't publish to the Marketplace — you need a standard one.
1. Create (or pick) a project at <https://console.cloud.google.com> → note its **Project number**.
2. Apps Script editor → **Project Settings** (gear) → **Google Cloud Platform (GCP) Project** →
   **Change project** → paste the project number → **Set project**.

## 2. 🔁 Create a versioned Add-on deployment
The Marketplace listing points at a specific, versioned deployment (not the head/test one).
1. Apps Script editor → **Deploy → New deployment**.
2. Select type **Add-on**. Give it a description/version (e.g. "v1").
3. **Deploy**, then **copy the Deployment ID** — you'll paste it into the Marketplace App Configuration.
   *(Repeat this and update the App Configuration's Deployment ID whenever you ship a new version you
   want live for installers.)*

## 3. 🟢 Enable the Google Workspace Marketplace SDK
1. Cloud console → **APIs & Services → Library** → search **"Google Workspace Marketplace SDK"** →
   **Enable** (in the same GCP project from step 1).

## 4. 🟢 App Configuration (Marketplace SDK)
Cloud console → **APIs & Services → Google Workspace Marketplace SDK → App Configuration**:
- **App visibility:** Public (required for consumer `@gmail.com` users; you'll make the *store listing*
  Unlisted in step 6 so it isn't publicly searchable).
- **Installation settings:** **Individual + admin** (lets each person self-install).
- **App integration:** **Google Workspace Add-on** → paste the **Deployment ID** from step 2.
- **OAuth scopes:** list all five (must match `gmail-addon/appsscript.json`):
  - `https://www.googleapis.com/auth/gmail.addons.execute`
  - `https://www.googleapis.com/auth/gmail.addons.current.message.readonly`
  - `https://www.googleapis.com/auth/gmail.addons.current.action.compose`
  - `https://www.googleapis.com/auth/script.external_request`
  - `https://www.googleapis.com/auth/userinfo.email`
- **Developer links:** privacy `https://reply-devon.duckdns.org/privacy`, terms `.../terms`.
- Save. *(Revisit only if scopes or the deployment change.)*

## 5. 🟢 OAuth consent screen
Cloud console → **APIs & Services → OAuth consent screen**:
- **User type:** External.
- **App name:** Reply Drafter · **User support email:** devonthomassmith@gmail.com ·
  **Developer contact:** devonthomassmith@gmail.com.
- **App logo:** upload the icon.
- **Authorized domains:** add `duckdns.org` and `vercel.app` (the hosts behind the privacy/terms and
  dashboard URLs).
- **App privacy policy:** `https://reply-devon.duckdns.org/privacy` ·
  **Terms of service:** `https://reply-devon.duckdns.org/terms`.
- **Scopes:** add the same five; paste the per-scope justifications from `docs/marketplace-listing.md`.
- **Publishing status:** set to **In production** (still unverified until step 7 completes — this stops
  the 7-day test-user token expiry).
- Save.

## 6. 🟢 Store Listing → publish Unlisted
Cloud console → **Google Workspace Marketplace SDK → Store Listing**:
- **App name, short description, long description:** paste from `docs/marketplace-listing.md`.
- **Category:** Productivity · **Language/region** as appropriate.
- **Graphics:** app icon + the 2–3 screenshots.
- **Support links:** privacy, terms, support email (as above).
- **Visibility:** **Unlisted** — installable via direct link, not shown in public search.
- **Publish.** You now have a Marketplace **install URL** to share (replaces "share project → test
  deployments"). *(Update + re-publish this listing whenever the copy/screenshots change.)*

## 7. 🟢 Submit for OAuth verification *(the step that unblocks Stanford-grade domains)*
Unlisted-but-unverified still shows the "unverified app" screen and is blocked by strict domains.
To remove that:
1. OAuth consent screen → **Prepare for verification / Submit for verification**.
2. Provide: the scope justifications (from `docs/marketplace-listing.md`), the privacy/terms URLs, and
   — usually required — a short **demo video** showing the OAuth grant and how each scope is used.
3. Submit. Your scopes are **sensitive, not restricted**, so this is a scope/brand review — **no CASA /
   third-party security assessment**. Expect days-to-weeks and possibly a follow-up email.
   *(Re-verification is only triggered if you later add/broaden scopes.)*

---

## How people install after publishing
- Send them the **Marketplace install link** from step 6 → **Install** → grant access.
- Before verification completes: personal Gmail + permissive domains work (with the unverified screen);
  strict domains (e.g. Stanford) may still block until step 7 is approved.
- After verification: one-click install, no unverified screen, and admin-allowed managed domains work.

## Per-release cheat sheet (🔁 when you change the add-on)
1. `cd gmail-addon && clasp push`.
2. **Deploy → New deployment → Add-on** → copy the new **Deployment ID** (step 2).
3. Update the **Deployment ID** in Marketplace SDK → **App Configuration** (step 4).
4. Only if you **changed OAuth scopes**: update scopes in App Configuration + consent screen, and
   **re-submit for verification** (step 7). No scope change → no re-verification.
5. Listing copy/screenshots changed? Update **Store Listing** and re-publish (step 6).
