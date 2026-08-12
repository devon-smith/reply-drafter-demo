/**
 * Reply Drafter — Gmail add-on entry points.
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

// Shared card chrome. LOGO_URL is served by the same VPS as /draft; ACCENT
// matches the dashboard's violet so the two surfaces read as one product.
// (Global consts are visible across every .gs file in the project.)
var LOGO_URL = 'https://reply-devon.duckdns.org/icon-128.png';
var ACCENT = '#7c74ff';

// A branded header (logo + title + subtitle), reused by every card.
function brandedHeader_(subtitle) {
  return CardService.newCardHeader()
    .setTitle('Reply Drafter')
    .setSubtitle(subtitle)
    .setImageUrl(LOGO_URL)
    .setImageStyle(CardService.ImageStyle.CIRCLE);
}

// Read a named form input from the (compose) action event. Handles both the
// newer commonEventObject.formInputs shape and the classic e.formInput map;
// returns '' when empty/absent.
function readFormValue_(e, name) {
  try {
    if (e && e.commonEventObject && e.commonEventObject.formInputs) {
      var f = e.commonEventObject.formInputs[name];
      if (f && f.stringInputs && f.stringInputs.value && f.stringInputs.value.length) {
        var v = String(f.stringInputs.value[0]).trim();
        if (v) return v;
      }
    }
    if (e && e.formInput && e.formInput[name] != null) {
      var v2 = String(e.formInput[name]).trim();
      if (v2) return v2;
    }
  } catch (x) {}
  return '';
}

// Read a named ACTION parameter (set via Action.setParameters on a chip). These
// ride the compose action alongside the form inputs; returns '' when absent.
function readParam_(e, name) {
  try {
    if (e && e.commonEventObject && e.commonEventObject.parameters &&
        e.commonEventObject.parameters[name] != null) {
      return String(e.commonEventObject.parameters[name]);
    }
    if (e && e.parameters && e.parameters[name] != null) return String(e.parameters[name]);
  } catch (x) {}
  return '';
}

// A ButtonSet of one-tap intent chips built from the static catalog
// (SteerCatalog.gs). Each chip is a compose action that generates the reply and
// opens the draft in ONE tap, carrying its preset id as an action parameter — the
// backend resolves the authoritative steer text from that id.
function steerChipButtons_() {
  var set = CardService.newButtonSet();
  for (var i = 0; i < STEER_PRESETS.length; i++) {
    var p = STEER_PRESETS[i];
    var action = CardService.newAction()
      .setFunctionName('onGenerateReply')
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
      .setParameters({ steer_preset_id: p.id, steer_source: 'static_chip' });
    set.addButton(CardService.newTextButton()
      .setText(p.label)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(ACCENT)
      .setComposeAction(action, CardService.ComposedEmailType.REPLY_AS_DRAFT));
  }
  return set;
}

// Pull a display name out of a "Name <email>" From header, falling back to the
// raw value (or a generic label) so the card never shows an empty line.
function senderName_(from) {
  if (!from) return 'this message';
  var m = String(from).match(/^\s*"?([^"<]+?)"?\s*</);
  return (m ? m[1] : from).trim() || 'this message';
}

// Homepage card — shown when the add-on is opened without a message context.
function onHomepage(e) {
  var section = CardService.newCardSection()
    .addWidget(CardService.newDecoratedText()
      .setText('Draft replies with Claude')
      .setBottomLabel('Open an email, then tap Generate reply.')
      .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.EMAIL))
      .setWrapText(true))
    .addWidget(CardService.newTextParagraph().setText(
      'The draft opens in a normal compose window, so you can edit it before sending.'))
    .addWidget(CardService.newDivider())
    .addWidget(CardService.newTextButton()
      .setText('Settings')
      .setOnClickAction(CardService.newAction().setFunctionName('onOpenSettings')));

  return CardService.newCardBuilder()
    .setHeader(brandedHeader_('Powered by Claude'))
    .addSection(section)
    .build();
}

// Contextual trigger: fires on every message open. Render a cheap card with a
// button; the token-spending model call happens only when the button is clicked.
function onGmailMessageOpen(e) {
  // Default "Generate reply" button — no preset. Uses whatever the user typed in
  // the free-text steer (if anything); otherwise a plain, unsteered draft.
  var generateAction = CardService.newAction()
    .setFunctionName('onGenerateReply')
    .setLoadIndicator(CardService.LoadIndicator.SPINNER);
  var generateButton = CardService.newTextButton()
    .setText('Generate reply')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(ACCENT)
    .setComposeAction(generateAction, CardService.ComposedEmailType.REPLY_AS_DRAFT);

  var contextSection = CardService.newCardSection();

  // Contextual "replying to" line so the card reflects the actual email.
  // Best-effort: a metadata read failure must never block the card.
  try {
    if (e && e.gmail && e.gmail.accessToken) {
      GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
      // Cache this WORKING message-access token (keyed by message id) so the
      // compose action can reuse it — the compose-action event does not reliably
      // carry a usable token of its own. Short TTL; user-scoped cache.
      if (e.gmail.messageId) {
        try { CacheService.getUserCache().put('rd_tok_' + e.gmail.messageId, e.gmail.accessToken, 600); } catch (cacheErr) {}
      }
      var m = GmailApp.getMessageById(e.gmail.messageId);
      contextSection.addWidget(CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.PERSON))
        .setTopLabel('Replying to')
        .setText(senderName_(m.getFrom()))
        .setBottomLabel(m.getSubject() || '(no subject)')
        .setWrapText(true));
    }
  } catch (ignore) {}

  // One-tap intent chips: pick an intent and the draft generates + opens in a
  // single tap. Each chip carries its preset id; the backend resolves the steer.
  var chipsSection = CardService.newCardSection()
    .setHeader('Reply in one tap')
    .addWidget(steerChipButtons_());

  // Free-text steer + the default generate button, for anything the chips don't
  // cover. Field name kept as userInstruction for backward compatibility.
  var steerSection = CardService.newCardSection()
    .addWidget(CardService.newTextInput()
      .setFieldName('userInstruction')
      .setTitle('Or say how to reply (optional)')
      .setHint('e.g. accept and propose Thursday, or keep it brief')
      .setMultiline(true))
    .addWidget(CardService.newButtonSet().addButton(generateButton));

  // Advanced (collapsed by default): one-off tone + length nudges for this reply.
  var advancedSection = CardService.newCardSection()
    .setHeader('Advanced')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0)
    .addWidget(CardService.newTextInput()
      .setFieldName('toneOverride')
      .setTitle('Tone for this reply (optional)')
      .setHint('e.g. formal, warm, direct'))
    .addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('length')
      .setTitle('Length')
      .addItem('Auto', 'medium', true)
      .addItem('Short', 'short', false)
      .addItem('Longer', 'long', false));

  var footerSection = CardService.newCardSection()
    .addWidget(CardService.newTextButton()
      .setText('Settings')
      .setOnClickAction(CardService.newAction().setFunctionName('onOpenSettings')));

  return CardService.newCardBuilder()
    .setHeader(brandedHeader_('Powered by Claude'))
    .addSection(contextSection)
    .addSection(chipsSection)
    .addSection(steerSection)
    .addSection(advancedSection)
    .addSection(footerSection)
    .build();
}

// Button action: read the message + thread, call the backend, return an
// editable draft reply. A compose action MUST return a ComposeActionResponse,
// so errors are surfaced as the draft body rather than a notification.
function onGenerateReply(e) {
  var msg;
  try {
    // Activate the temporary message-access token BEFORE any GmailApp read. The
    // compose-action event does not reliably carry a usable token, so fall back
    // to the one cached by the message-open trigger (keyed by message id). A
    // current-message token also grants read access to the rest of the thread.
    var token = (e && e.gmail && e.gmail.accessToken) || '';
    if (!token && e && e.gmail && e.gmail.messageId) {
      try { token = CacheService.getUserCache().get('rd_tok_' + e.gmail.messageId) || ''; } catch (cacheErr) {}
    }
    if (token) GmailApp.setCurrentMessageAccessToken(token);
    msg = GmailApp.getMessageById(e.gmail.messageId);

    var payload = buildDraftPayload(msg);

    // userEmail drives the backend's per-user Supabase lookup (KB + prompt/tone
    // managed in the dashboard). Lowercased to match how the dashboard/JWT stores
    // it. The local Settings overrides are a FALLBACK the backend only applies
    // when the user has no Supabase rows. Best-effort: getEmail() needs the
    // userinfo.email scope, so guard it — a missing scope should degrade to a
    // non-personalized draft, never abort the whole reply.
    try {
      var addr = (Session.getActiveUser().getEmail() || '').toLowerCase();
      if (addr) payload.userEmail = addr;
    } catch (scopeErr) {
      // no userinfo.email scope granted yet — draft with file/local defaults
    }
    var overrides = getOverrides_();
    if (overrides) payload.overrides = overrides;

    // Per-reply steer (this draft only; never saved). Precedence: free text the
    // user typed wins over a tapped chip (it is more specific); otherwise the
    // chip's preset id drives the steer. Tone + length are optional one-off nudges.
    var freeText = readFormValue_(e, 'userInstruction');
    var presetId = readParam_(e, 'steer_preset_id');
    if (freeText) {
      payload.steer_text = freeText;
      payload.steer_source = 'free_text';
    } else if (presetId) {
      payload.steer_preset_id = presetId;
      payload.steer_source = 'static_chip';
    }
    var tone = readFormValue_(e, 'toneOverride');
    if (tone) payload.tone_override = tone;
    var length = readFormValue_(e, 'length');
    if (length && length !== 'medium') payload.length = length;

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
