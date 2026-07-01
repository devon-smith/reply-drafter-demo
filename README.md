# Reply Drafter (Demo)

A deliberately tiny Outlook add-in whose only job is to answer one question:
**can a custom add-in run on this account, and can it read an email and open a reply?**

It does three things — nothing more:
1. Loads a task pane (proves custom add-ins are permitted on the account).
2. Reads the open message's sender, subject, and body via Office.js.
3. Opens a reply with prefilled text.

No backend, no AI, no Microsoft Graph, no OAuth consent. Those are all real parts of the
finished product, but each one adds a way for the test to fail for reasons unrelated to
"does the school tenant allow this." They come later.

---

## Setup

### Step A — Host the files

The add-in's web files (`taskpane.html`, `taskpane.css`, `taskpane.js`, `commands.html`,
and the five `icon-*.png` files) must be served over **HTTPS**. Two options:

**Option 1 — GitHub Pages (recommended for a locked-down school machine).**
The only thing that then has to happen on the school computer is sideloading the manifest —
no Node, no dev certificates, no local server. From any machine:
1. Create a public GitHub repo and add every file in this folder to its root.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick
   `main` / root, save. Wait ~1 minute.
3. Your base URL is `https://YOUR-USERNAME.github.io/YOUR-REPO`. Confirm
   `https://YOUR-USERNAME.github.io/YOUR-REPO/taskpane.html` loads in a browser.

**Option 2 — localhost.** Requires Node on the machine:
```
npx office-addin-dev-certs install        # trust a localhost HTTPS cert
npx http-server . -S -C ~/.office-addin-dev-certs/localhost.crt \
    -K ~/.office-addin-dev-certs/localhost.key -p 3000
```
Base URL is `https://localhost:3000`.

### Step B — Point the manifest at your base URL

In `manifest.xml`, find-and-replace every occurrence of:
```
https://REPLACE-ME.example.com
```
with your base URL from Step A (no trailing slash). There are several occurrences — replace
all of them.

---

## Sideload on the school account

In **new Outlook for Windows** or **Outlook on the web**:
1. Open any received email.
2. Toolbar **More actions (···) → Add-ins → Get add-ins** (wording varies by build).
3. In the dialog, go to **My add-ins**, find **Custom Addins**, choose **Add a custom add-in →
   Add from file…**, and select your edited `manifest.xml`.

Microsoft's current sideload steps (with screenshots) are here if the menu differs:
`https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing`

Then reopen a message and look for a **Draft reply** button (Reply Drafter group) on the
ribbon / message action bar. Click it to open the pane.

---

## Reading the result — this is the actual test

- **The pane opens, reads the email, and "Open a prefilled reply" launches a reply** →
  custom add-ins and Office.js both work on this account. The full build is viable here.
- **You never see "Add a custom add-in," or it errors with "Access is denied / contact your
  administrator"** → the tenant's IT has blocked user-installed Outlook add-ins (the Exchange
  `My Custom Apps` role is off). You can't sideload here without IT enabling it or deploying
  the add-in for you. This is the blocker to know about before building anything larger.
- **The pane opens but reading fails** → almost always a hosting/HTTPS or manifest-URL issue,
  not a tenant policy issue. Recheck that every `REPLACE-ME` URL was replaced and that
  `taskpane.html` loads directly in a browser.

To remove the add-in afterward: same **My add-ins** list → the add-in → **Remove**.

---

## Next step (once it loads)

Swap the static template in `taskpane.js` (marked `AI SLOT`) for a call to a small backend
that does retrieval over your sent-mail voice profile plus the knowledge base, then returns a
generated draft. Reading full thread context (rather than just the open message) is the point
where Microsoft Graph and its consent prompt enter — deliberately kept out of this demo.
# reply-drafter-demo
