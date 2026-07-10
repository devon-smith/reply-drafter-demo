# Reply Drafter - OAuth Verification Demo Video Script

Purpose: a single continuous screen recording (~3-4 minutes) that shows the complete
end-to-end flow and visibly exercises all five OAuth scopes requested in the
verification submission. Record at 1280x800 or larger, with voice narration on
(or burned-in captions if narration isn't possible).

Use a demo/test Gmail account and a demo email thread. Nothing private or
real should appear on screen at any point.

---

## 0. Title card (0:00-0:10)

**On screen:** "Reply Drafter - OAuth Scope Verification Demo"

**Narrate/caption:** "This video shows Reply Drafter's complete install and use
flow, and demonstrates each of the five OAuth scopes the add-on requests."

---

## 1. Install the add-on + grant consent (0:10-0:45)

**Scope demonstrated:** the OAuth consent grant itself (covers all five scopes
declared on the consent screen).

**What to do:** From the Google Workspace Marketplace listing (or admin install
screen), install the Reply Drafter add-on. Let the OAuth consent screen appear
and show it on screen long enough to read.

**Narrate/caption:** "Installing Reply Drafter shows one consent screen listing
the scopes the add-on needs. We grant consent once, here."

**Note:** Show one clean permission screen - don't click through it too fast.
Pause on it for a couple of seconds so the scope list is legible.

---

## 2. Open an email, the card reads the message/thread (0:45-1:30)

**Scope demonstrated:** `gmail.addons.current.message.readonly`

**What to do:** Open a demo email in Gmail (use a fake/innocuous thread with a
prior reply so there's quoted history). Open the Reply Drafter side panel so
the card is visible next to the message.

**Narrate/caption:** "Opening an email loads the Reply Drafter card. It reads
only the message you currently have open, and its quoted thread, so the
draft it produces is relevant. It cannot see any other message in the inbox."

---

## 3. Click Generate reply, backend call + add-on execution (1:30-2:15)

**Scopes demonstrated:** `script.external_request` (the outbound call to our
backend) and `gmail.addons.execute` (the add-on running inside Gmail to handle
the click and render the result).

**What to do:** Click "Generate reply" in the card. Let the loading state show
briefly, then let the result appear.

**Narrate/caption:** "Clicking Generate reply runs the add-on's code inside
Gmail, that's the execute scope, which calls our own backend over HTTPS to
produce the draft. The backend forwards the request to Claude and returns the
drafted text. No other outbound calls are made."

---

## 4. Draft opens in an editable compose window (2:15-3:00)

**Scope demonstrated:** `gmail.addons.current.action.compose`

**What to do:** Show the generated draft appearing in a standard Gmail compose
window. Edit a word or sentence on camera to make clear it's a normal, fully
editable draft, not a sent message.

**Narrate/caption:** "The draft opens in a normal, editable Gmail compose
window. Nothing is sent automatically, the user reviews, can edit, and sends
it themselves."

---

## 5. Dashboard, sign-in loads the user's own settings (3:00-3:45)

**Scope demonstrated:** `userinfo.email`

**What to do:** Switch to the Reply Drafter web dashboard
(reply-drafter-demo.vercel.app or reply-drafter.com once live). Show signing
in with the same demo Google account, and the dashboard loading that user's
own tone/settings.

**Narrate/caption:** "The dashboard uses the same Google sign-in only to look
up the signed-in user's own email address, so it can load that person's saved
tone and writing settings. We don't read the user's name or any other profile
data, just the email address, used as an account key."

---

## 6. Closing card (3:45-4:00)

**On screen:** "Reply Drafter - five scopes, one consent screen, no email sent
without the user's review."

**Narrate/caption:** "That's the complete flow: install and consent once, read
the open message, generate a draft through our backend, place it in an
editable compose window, and load the user's own settings by email address.
Thank you."

---

## Recording checklist

- [ ] Use a demo Gmail account, not a real/personal inbox.
- [ ] Use a fake or innocuous demo email thread - no real names, no real personal data.
- [ ] Show exactly one consent/permission screen at install; pause on it.
- [ ] Keep each of the five scope-demonstrating steps visually distinct and narrated/captioned so a reviewer can map screen time to scope.
- [ ] Total runtime ~3-4 minutes.
- [ ] Export and upload; paste the resulting link into `docs/verification-reply-template.md` in place of `[VIDEO LINK]`.
