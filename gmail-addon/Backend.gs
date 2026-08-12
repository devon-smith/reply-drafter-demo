/**
 * Talks to the existing /draft endpoint on the VPS.
 *
 * Configuration lives in Script Properties (set once via the editor or clasp,
 * never committed to git):
 *   DRAFT_URL    - full endpoint, e.g. https://reply-devon.duckdns.org/draft
 *   DRAFT_SECRET - shared secret sent as the X-Api-Key header (optional until
 *                  the backend enforces it; safe to set now)
 *
 * The secret is project-scoped and the code runs on Google's servers, so it is
 * never exposed to end users. HTTPS (Caddy) keeps the header encrypted in
 * transit.
 */
function callDraftBackend(payload) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('DRAFT_URL');
  var secret = props.getProperty('DRAFT_SECRET');
  if (!url) throw new Error('DRAFT_URL is not set in Script Properties.');

  var headers = {};
  if (secret) headers['X-Api-Key'] = secret;

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code !== 200) {
    var detail = text;
    try { detail = JSON.parse(text).error || text; } catch (ignore) {}
    throw new Error('Backend ' + code + ': ' + detail);
  }
  return JSON.parse(text);
}

// Backend base URL, derived from DRAFT_URL by stripping the /draft suffix, so the
// v2 endpoints (/suggest, /steers) don't need their own Script Properties.
function backendBase_() {
  var url = PropertiesService.getScriptProperties().getProperty('DRAFT_URL') || '';
  return url.replace(/\/draft\/?$/, '');
}
function backendHeaders_() {
  var secret = PropertiesService.getScriptProperties().getProperty('DRAFT_SECRET');
  return secret ? { 'X-Api-Key': secret } : {};
}

// Ask the backend for smart steer chips for this message. FAIL-SAFE: returns the
// parsed { source, chips } object, or null on any error/non-200 so the caller
// falls back to the static catalog. The backend enforces the timeout server-side.
function callSuggestBackend(payload) {
  try {
    var base = backendBase_();
    if (!base) return null;
    var res = UrlFetchApp.fetch(base + '/suggest', {
      method: 'post',
      contentType: 'application/json',
      headers: backendHeaders_(),
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return null;
    return JSON.parse(res.getContentText());
  } catch (e) {
    return null;
  }
}

// Fetch a user's saved steers. FAIL-SAFE: returns an array (possibly empty), or
// [] on any error. Result is cached by the caller to avoid a fetch on every open.
function callSteersBackend(userEmail) {
  try {
    var base = backendBase_();
    if (!base || !userEmail) return [];
    var res = UrlFetchApp.fetch(base + '/steers', {
      method: 'post',
      contentType: 'application/json',
      headers: backendHeaders_(),
      payload: JSON.stringify({ userEmail: userEmail }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return [];
    var obj = JSON.parse(res.getContentText());
    return (obj && obj.steers) ? obj.steers : [];
  } catch (e) {
    return [];
  }
}
