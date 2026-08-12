/**
 * Reply Drafter — static steer catalog (Apps Script mirror).
 *
 * The canonical catalog lives in server/steerCatalog.js. Apps Script cannot
 * require() that file, so this is a hand-kept mirror of the preset IDS + display
 * LABELS only. The add-on sends { steer_preset_id } to /draft and the SERVER
 * resolves the authoritative steer_text from its own catalog — so the actual
 * drafting instruction is never duplicated here, and the two files only need
 * their ids to agree. Labels are display-only chip text.
 *
 * Keep the ids identical to server/steerCatalog.js. If a label drifts the chip
 * wording differs but drafting is unaffected; if an id drifts the server sees an
 * unknown preset and injects no steer for that chip.
 *
 * These are the guaranteed static chips shown immediately on every message open,
 * and the fallback when smart /suggest chips are unavailable.
 */

var STEER_PRESETS = [
  { id: 'accept',           label: 'Accept' },
  { id: 'politely_decline', label: 'Politely decline' },
  { id: 'propose_time',     label: 'Propose a time' },
  { id: 'need_more_info',   label: 'Ask for details' },
  { id: 'quick_thanks',     label: 'Quick thanks' },
  { id: 'follow_up',        label: 'Follow up' }
];

// Look up a preset's display label by id, falling back to the id itself.
function steerLabelForId_(id) {
  for (var i = 0; i < STEER_PRESETS.length; i++) {
    if (STEER_PRESETS[i].id === id) return STEER_PRESETS[i].label;
  }
  return id;
}
