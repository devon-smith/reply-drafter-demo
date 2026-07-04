// Reply Drafter backend. Express + native fetch (Node 20). No SDK, no dotenv
// (env comes from docker compose env_file). Plain HTTP behind Caddy.
const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const KEY = process.env.ANTHROPIC_API_KEY;

// Optional shared secret for cross-origin callers (e.g. the Gmail add-on via
// UrlFetchApp). If unset, /draft enforces nothing — the same-origin Outlook pane
// keeps working exactly as before. See requireAuth() below.
const API_SECRET = process.env.API_SECRET;

// Optional Supabase per-user config store. Initialized only when both env vars
// are present, so the server (and the Outlook path) still boot without it and
// without the dependency installed. The service-role key bypasses RLS — it is
// read here server-side only and must never reach any client.
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Editable prompt + knowledge base. Both live at the repo root and are mounted
// as compose volumes, so they can be edited without a rebuild — we read them
// FRESH on every request. Missing/empty/unreadable files fall back safely.
const ROOT = path.join(__dirname, "..");
const PROMPT_PATH = path.join(ROOT, "prompt", "system.md");
const KB_DIR = path.join(ROOT, "kb");
const KB_CAP = 8000;      // max chars of KB facts injected into the prompt
const OVR_APPEND_CAP = 4000; // max chars of per-user extra instructions
const OVR_KB_CAP = 8000;  // max chars of per-user KB facts
const OVR_TONE_CAP = 200; // max chars of per-user tone directive
const SYSTEM_CAP = 24000; // hard cap on the fully assembled system prompt

app.use(express.json({ limit: "1mb" }));

// Serve the add-in's static files (taskpane.html, css, manifest, icons) from the
// repo root. express.static ignores dotfiles by default, so .env is NOT served.
app.use(express.static(path.join(__dirname, "..")));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    model: MODEL,
    keyConfigured: Boolean(KEY),
    supabaseConfigured: Boolean(supabase),
  });
});

// Look up a user's per-user config in Supabase (service key, bypasses RLS).
// Returns an overrides-shaped object { systemPromptAppend?, kb?, tone? } or null
// when Supabase is unconfigured, the user is unknown, or on any error — the
// caller then falls back to request-body overrides / file defaults.
async function loadUserConfig(userEmail) {
  if (!supabase || !userEmail) return null;
  const email = String(userEmail).trim().toLowerCase();
  if (!email) return null;
  try {
    const [kbRes, psRes] = await Promise.all([
      supabase.from("kb_entry").select("title,content").eq("user_email", email),
      supabase
        .from("prompt_setting")
        .select("system_prompt_append,tone")
        .eq("user_email", email)
        .maybeSingle(),
    ]);
    const kbRows = (kbRes && kbRes.data) || [];
    const ps = (psRes && psRes.data) || null;
    const kb = kbRows
      .map((r) => (r.title ? `## ${r.title}\n${r.content}` : String(r.content || "")))
      .join("\n\n")
      .trim();
    const out = {};
    if (kb) out.kb = kb;
    if (ps && ps.system_prompt_append) out.systemPromptAppend = ps.system_prompt_append;
    if (ps && ps.tone) out.tone = ps.tone;
    return Object.keys(out).length ? out : null;
  } catch (e) {
    console.error("supabase lookup failed:", (e && e.message) || e);
    return null;
  }
}

// Fallback used only if prompt/system.md is missing or empty. Keep in sync with
// that file; the file is the source of truth in normal operation.
const DEFAULT_SYSTEM_PROMPT =
  "You are drafting an email reply on behalf of the user. Write a concise, " +
  "professional reply to the email provided. Return ONLY the reply body text: " +
  "no subject line, no preamble, no explanation, and no signature block beyond a " +
  "simple sign-off line.\n\n" +
  "The email body may include quoted conversation history from earlier in the " +
  'thread (typically marked by lines like "On <date>, <name> wrote:" followed by ' +
  "the earlier messages, often indented or prefixed with '>'). Use that history " +
  "as context to understand the conversation, but write your reply ONLY to the " +
  "most recent message. Do NOT quote, restate, or repeat the earlier history in " +
  "your output — return just the new reply text.";

// Read the editable system prompt fresh. Falls back to the built-in default if
// the file is missing, empty, or unreadable.
async function loadSystemPrompt() {
  try {
    const text = (await fs.readFile(PROMPT_PATH, "utf8")).trim();
    return text || DEFAULT_SYSTEM_PROMPT;
  } catch {
    return DEFAULT_SYSTEM_PROMPT;
  }
}

// Read all kb/*.md and kb/*.txt fact files fresh, concatenate (sorted, each
// labelled with its filename), and cap the combined block. Returns "" if the
// directory is missing/empty or unreadable — never throws.
async function loadKnowledgeBase() {
  try {
    const entries = await fs.readdir(KB_DIR);
    const files = entries.filter((f) => /\.(md|txt)$/i.test(f)).sort();
    const chunks = [];
    for (const f of files) {
      try {
        const body = (await fs.readFile(path.join(KB_DIR, f), "utf8")).trim();
        if (body) chunks.push(`## ${f}\n${body}`);
      } catch {
        // skip an individual unreadable file, keep the rest
      }
    }
    return chunks.join("\n\n").slice(0, KB_CAP);
  } catch {
    return "";
  }
}

// Assemble the final system prompt: editable base + optional KB facts block +
// optional per-user overrides. With no overrides, output is identical to before.
async function buildSystemPrompt(overrides) {
  const base = await loadSystemPrompt();
  const kb = await loadKnowledgeBase();
  let out = base;
  if (kb) {
    out +=
      "\n\n---\nKnowledge base — facts about the user and their context. Use these " +
      "when relevant to the reply; do not invent details beyond them.\n\n" +
      kb;
  }

  if (overrides && typeof overrides === "object") {
    const str = (v) => (typeof v === "string" ? v.trim() : "");
    const tone = str(overrides.tone).slice(0, OVR_TONE_CAP);
    const append = str(overrides.systemPromptAppend).slice(0, OVR_APPEND_CAP);
    const userKb = str(overrides.kb).slice(0, OVR_KB_CAP);
    if (tone) out += "\n\n---\nTone: write the reply in this tone/style: " + tone;
    if (append) out += "\n\n---\nAdditional instructions from the user:\n" + append;
    if (userKb) out += "\n\n---\nAdditional knowledge base facts for this user:\n" + userKb;
  }

  return out.slice(0, SYSTEM_CAP);
}

// Same-origin check: the served Outlook pane calls /draft from the same host, so
// its request carries an Origin/Referer whose host matches ours. Cross-origin
// callers (the Gmail add-on via UrlFetchApp) send neither.
function isSameOrigin(req) {
  const host = req.headers.host;
  if (!host) return false;
  const src = req.headers.origin || req.headers.referer;
  if (!src) return false;
  try {
    return new URL(src).host === host;
  } catch {
    return false;
  }
}

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Authorization policy: if API_SECRET is unset, allow everything (current
// behavior). If set, allow a request when it is EITHER same-origin (the browser
// pane) OR carries a matching x-api-key header (the Gmail add-on).
function requireAuth(req) {
  if (!API_SECRET) return true;
  if (isSameOrigin(req)) return true;
  const provided = req.headers["x-api-key"];
  return typeof provided === "string" && timingSafeEqualStr(provided, API_SECRET);
}

app.post("/draft", async (req, res) => {
  try {
    if (!requireAuth(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!KEY) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on the server." });
    }
    const { from = "", subject = "", body = "", userEmail = "", overrides } = req.body || {};
    if (!String(body).trim()) {
      return res.status(400).json({ error: "Email body is required." });
    }
    // Cap combined input. Raised to 16000 to fit quoted thread history in the body.
    const incoming = `From: ${from}\nSubject: ${subject}\n\n${body}`.slice(0, 16000);

    // Per-user config: a user's Supabase rows (KB + prompt/tone) supersede any
    // request-body overrides; with no user / no rows / no Supabase we fall back
    // to the request overrides, then to the mounted file defaults.
    const userConfig = await loadUserConfig(userEmail);
    const effectiveOverrides = userConfig || overrides;

    // Fresh read of the editable prompt + KB on every request, plus the
    // effective per-user overrides.
    const system = await buildSystemPrompt(effectiveOverrides);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: `Draft a reply to this email:\n\n${incoming}` }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: `Claude API ${r.status}`, detail: detail.slice(0, 500) });
    }
    const data = await r.json();
    const reply = (data.content && data.content[0] && data.content[0].text || "").trim();
    if (!reply) return res.status(502).json({ error: "Empty reply from Claude." });
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: String((e && e.message) || e) });
  }
});

app.listen(PORT, () => console.log(`reply-drafter listening on :${PORT} (model ${MODEL})`));
