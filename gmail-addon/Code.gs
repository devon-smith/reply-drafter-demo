/**
 * Family Reply Drafter — Gmail add-on entry points.
 *
 * Flow: open a message -> a contextual card renders instantly with a
 * "Generate reply" button -> on click we read the message + its thread, POST to
 * the existing /draft backend, and hand Gmail a pre-filled, editable draft reply
 * (createDraftReply + ComposeActionResponse). The Anthropic key stays
 * server-side; the add-on only ever talks to /draft.
 *
 * The model call happens on the button click, NOT on message open: contextual
 * triggers fire on every message open and every switch between messages, so
 * auto-calling would burn Anthropic tokens and UrlFetch quota on mail the user
 * never meant to reply to.
 */

// Homepage card — shown when the add-on is opened without a message context.
function onHomepage(e) {
  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(
      'Open an email, then use <b>Generate reply</b> to draft a response with Claude. ' +
      'The draft opens in a normal compose window so you can edit before sending.'))
    .addWidget(CardService.newTextButton()
      .setText('Settings')
      .setOnClickAction(CardService.newAction().setFunctionName('onOpenSettings')));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Family Reply Drafter'))
    .addSection(section)
    .build();
}

// Contextual trigger: fires on every message open. Render a cheap card with a
// button; the token-spending model call happens only when the button is clicked.
function onGmailMessageOpen(e) {
  var action = CardService.newAction()
    .setFunctionName('onGenerateReply')
    .setLoadIndicator(CardService.LoadIndicator.SPINNER);

  var generateButton = CardService.newTextButton()
    .setText('Generate reply')
    .setComposeAction(action, CardService.ComposedEmailType.REPLY_AS_DRAFT);

  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(
      'Draft a reply to this email with Claude. You can edit it before sending.'))
    .addWidget(generateButton);

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Reply Drafter'))
    .addSection(section)
    .build();
}

// Button action: read the message + thread, call the backend, return an
// editable draft reply. A compose action MUST return a ComposeActionResponse,
// so errors are surfaced as the draft body rather than a notification.
function onGenerateReply(e) {
  var msg;
  try {
    // Activate the temporary Gmail scope for this event before using GmailApp.
    // A gmail.addons.current.message.readonly token also grants read access to
    // the other messages in the thread.
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    msg = GmailApp.getMessageById(e.gmail.messageId);

    var payload = buildDraftPayload(msg);

    // userEmail drives the backend's per-user Supabase lookup (KB + prompt/tone
    // managed in the dashboard). Lowercased to match how the dashboard/JWT stores
    // it. The local Settings overrides are a FALLBACK the backend only applies
    // when the user has no Supabase rows.
    payload.userEmail = (Session.getActiveUser().getEmail() || '').toLowerCase();
    var overrides = getOverrides_();
    if (overrides) payload.overrides = overrides;

    var result = callDraftBackend(payload);
    var reply = (result && result.reply ? String(result.reply) : '').trim();
    if (!reply) reply = '[Reply Drafter] Claude returned an empty reply — try again.';

    var draft = msg.createDraftReply(reply);
    return CardService.newComposeActionResponseBuilder()
      .setGmailDraft(draft)
      .build();
  } catch (err) {
    var text = '[Reply Drafter] Could not draft a reply: ' +
      (err && err.message ? err.message : err);
    if (msg) {
      return CardService.newComposeActionResponseBuilder()
        .setGmailDraft(msg.createDraftReply(text))
        .build();
    }
    throw err;
  }
}

// Build the { from, subject, body } payload the /draft endpoint expects. The
// body carries the open message plus earlier thread turns as quoted history, so
// the server's "reply only to the most recent message, use history as context"
// prompt behaves the same as the Outlook path.
function buildDraftPayload(msg) {
  var target = msg;
  var thread = msg.getThread();
  var messages = thread ? thread.getMessages() : [target];

  var history = [];
  for (var i = messages.length - 1; i >= 0; i--) {
    var m = messages[i];
    if (m.getId() === target.getId()) continue;
    history.push('On ' + m.getDate() + ', ' + m.getFrom() + ' wrote:\n' +
      m.getPlainBody().trim());
  }

  var body = target.getPlainBody().trim();
  if (history.length) body += '\n\n' + history.join('\n\n');

  return {
    from: target.getFrom(),
    subject: target.getSubject(),
    body: body
  };
}
