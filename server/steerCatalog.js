// Static steer catalog — the canonical set of one-tap reply intents ("chips").
// This is the SOURCE OF TRUTH for preset ids, labels, and steer text. It is used
// two ways:
//   1. As the direct backing for /draft when a client sends { steer_preset_id }.
//   2. As the guaranteed fallback for /suggest — when smart classification is
//      slow, over budget, or errors, the panel still shows these presets, so the
//      card NEVER blocks on the model.
//
// The Gmail add-on carries a hand-kept mirror of the ids + labels in
// gmail-addon/SteerCatalog.gs (Apps Script can't require() this file). Keep the
// two in sync: the ids MUST match, because the add-on sends steer_preset_id and
// the server resolves the authoritative steer_text from THIS file. Labels are
// display-only; if they drift, the chip text differs but drafting is unaffected.
//
// Contract per preset: { id, label (<=3 words, for the chip), steer_text (the
// instruction actually injected into the draft — the same slot a free-text steer
// fills) }.

const STEER_PRESETS = [
  {
    id: "accept",
    label: "Accept",
    steer_text:
      "Accept or agree to what they are proposing. Say yes clearly and warmly, and confirm the next step if there is one.",
  },
  {
    id: "politely_decline",
    label: "Politely decline",
    steer_text:
      "Politely decline or say no. Be kind and appreciative but clear; do not over-explain or make promises you were not asked to make.",
  },
  {
    id: "propose_time",
    label: "Propose a time",
    steer_text:
      "Express interest in meeting or talking and move toward scheduling. Suggest finding a specific time to connect, without inventing exact dates you were not given.",
  },
  {
    id: "need_more_info",
    label: "Ask for details",
    steer_text:
      "Ask the clarifying question or request the specific details needed before you can respond fully. Keep it focused on what you actually need to know.",
  },
  {
    id: "quick_thanks",
    label: "Quick thanks",
    steer_text:
      "Send a short, genuine thank-you that acknowledges their message. Keep it brief and warm; no new requests.",
  },
  {
    id: "follow_up",
    label: "Follow up",
    steer_text:
      "Follow up or gently nudge for a response or the next step. Be polite and brief, and make the ask clear.",
  },
];

const _byId = new Map(STEER_PRESETS.map((p) => [p.id, p]));

// Resolve a preset id to its authoritative steer_text, or "" for unknown/empty.
function steerTextForPreset(id) {
  if (typeof id !== "string") return "";
  const p = _byId.get(id.trim());
  return p ? p.steer_text : "";
}

// The subset safe to expose to clients / suggest responses (no server-only fields
// today, but this keeps the shape explicit if that ever changes).
function publicPresets() {
  return STEER_PRESETS.map((p) => ({ id: p.id, label: p.label, steer_text: p.steer_text }));
}

module.exports = { STEER_PRESETS, steerTextForPreset, publicPresets };
