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
