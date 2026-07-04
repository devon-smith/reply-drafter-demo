/**
 * Per-user customization stored in UserProperties — private to each user, no
 * backend storage. These overrides ride along in the /draft request body; the
 * backend is expected to layer them over its default prompt/system.md and
 * kb/*.md, falling back to those defaults when a field is absent.
 *
 * Until the backend supports overrides, they are simply ignored server-side
 * (destructured away), so saving them now is harmless.
 */
var OVR_TONE = 'ovr_tone';
var OVR_PROMPT = 'ovr_prompt';
var OVR_KB = 'ovr_kb';

// Universal/homepage action: open the settings card.
function onOpenSettings(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(buildSettingsCard_()))
    .build();
}

function buildSettingsCard_() {
  var p = PropertiesService.getUserProperties();
  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(
      '<i>Fallback settings.</i> Your main knowledge base and tone are managed in the ' +
      'web dashboard. These local values are used only if you have no dashboard config.'))
    .addWidget(CardService.newTextInput()
      .setFieldName(OVR_TONE)
      .setTitle('Tone (optional)')
      .setHint('e.g. warm and brief; formal; playful')
      .setValue(p.getProperty(OVR_TONE) || ''))
    .addWidget(CardService.newTextInput()
      .setFieldName(OVR_PROMPT)
      .setTitle('Extra instructions (optional)')
      .setMultiline(true)
      .setValue(p.getProperty(OVR_PROMPT) || ''))
    .addWidget(CardService.newTextInput()
      .setFieldName(OVR_KB)
      .setTitle('Personal facts / knowledge (optional)')
      .setHint('A few lines drafts can rely on: name, sign-off, context.')
      .setMultiline(true)
      .setValue(p.getProperty(OVR_KB) || ''))
    .addWidget(CardService.newTextButton()
      .setText('Save')
      .setOnClickAction(CardService.newAction().setFunctionName('onSaveSettings')))
    .addWidget(CardService.newTextButton()
      .setText('Clear')
      .setOnClickAction(CardService.newAction().setFunctionName('onClearSettings')));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Reply Drafter — Settings'))
    .addSection(section)
    .build();
}

function onSaveSettings(e) {
  var f = (e && e.formInput) || {};
  var p = PropertiesService.getUserProperties();
  p.setProperty(OVR_TONE, f[OVR_TONE] || '');
  p.setProperty(OVR_PROMPT, f[OVR_PROMPT] || '');
  p.setProperty(OVR_KB, f[OVR_KB] || '');
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Settings saved.'))
    .build();
}

function onClearSettings(e) {
  var p = PropertiesService.getUserProperties();
  p.deleteProperty(OVR_TONE);
  p.deleteProperty(OVR_PROMPT);
  p.deleteProperty(OVR_KB);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Settings cleared.'))
    .setStateChanged(true)
    .build();
}

// Assemble overrides for the /draft body. Returns null when nothing is set.
function getOverrides_() {
  var p = PropertiesService.getUserProperties();
  var tone = p.getProperty(OVR_TONE) || '';
  var prompt = p.getProperty(OVR_PROMPT) || '';
  var kb = p.getProperty(OVR_KB) || '';
  if (!tone && !prompt && !kb) return null;

  var o = {};
  if (tone) o.tone = tone;
  if (prompt) o.systemPromptAppend = prompt;
  if (kb) o.kb = kb;
  return o;
}
