// Reply Drafter backend. Express + native fetch (Node 22). No SDK, no dotenv
// (env comes from docker compose env_file). Plain HTTP behind Caddy.
const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { steerTextForPreset, publicPresets } = require("./steerCatalog");

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
const SYSTEM_CAP = 32000; // hard cap on the fully assembled system prompt
const KB_GUIDANCE_CAP = 16000; // max combined chars of per-user style+examples+facts (kb_entry + kb_file)
const INSTRUCTION_CAP = 2000; // max chars of the optional per-reply user instruction (not persisted)

// Anthropic pricing (USD per 1M tokens) for usage_event.est_cost_usd. Override
// per-model via env; defaults are Sonnet-ish placeholders.
const numEnv = (v, d) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);
const PRICE_INPUT_PER_MTOK = numEnv(process.env.PRICE_INPUT_PER_MTOK, 3);
const PRICE_OUTPUT_PER_MTOK = numEnv(process.env.PRICE_OUTPUT_PER_MTOK, 15);

// Cost guardrails (per user, env-configurable). Daily caps are Supabase-backed
// (usage_event); the short-window rate limit is in-memory and resets on restart.
const DAILY_TOKEN_CAP = numEnv(process.env.DAILY_TOKEN_CAP, 500000);
const DAILY_REQUEST_CAP = numEnv(process.env.DAILY_REQUEST_CAP, 100);
const RATE_LIMIT_PER_MIN = numEnv(process.env.RATE_LIMIT_PER_MIN, 10);
const rlHits = new Map(); // rate-limit key -> array of request timestamps (ms)

// Smart-chip classification (/suggest). A cheap, fast model proposes up to three
// contextual reply intents on message open. Everything here is fail-safe: the
// panel shows the STATIC catalog if suggestion is slow, over budget, or errors —
// the model call is raced against SUGGEST_TIMEOUT_MS server-side (UrlFetchApp has
// no per-call timeout, so the deadline MUST be enforced here, never client-side).
const SUGGEST_MODEL = process.env.SUGGEST_MODEL || "claude-haiku-4-5-20251001";
const SUGGEST_TIMEOUT_MS = numEnv(process.env.SUGGEST_TIMEOUT_MS, 2500);
const SUGGEST_DAILY_TOKEN_CAP = numEnv(process.env.SUGGEST_DAILY_TOKEN_CAP, 200000);
const SUGGEST_LRU_TTL_S = numEnv(process.env.SUGGEST_LRU_TTL_S, 3600);
// Haiku pricing (USD per 1M tokens) for /suggest metering. Cheap vs the drafting
// model; overridable per-deploy.
const SUGGEST_PRICE_INPUT_PER_MTOK = numEnv(process.env.SUGGEST_PRICE_INPUT_PER_MTOK, 1);
const SUGGEST_PRICE_OUTPUT_PER_MTOK = numEnv(process.env.SUGGEST_PRICE_OUTPUT_PER_MTOK, 5);

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

// Static legal pages (extensionless), required for the Marketplace listing +
// OAuth consent screen. express.static already serves /privacy.html and
// /terms.html from the repo root; these give the clean /privacy and /terms URLs.
// Read-only GETs — they don't touch /draft, auth, or the pane.
app.get("/privacy", (req, res) => res.sendFile(path.join(ROOT, "privacy.html")));
app.get("/terms", (req, res) => res.sendFile(path.join(ROOT, "terms.html")));
app.get("/support", (req, res) => res.sendFile(path.join(ROOT, "support.html")));

// Look up a user's per-user config in Supabase (service key, bypasses RLS).
// Returns an overrides-shaped object { systemPromptAppend?, kb?, tone? } or null
// when Supabase is unconfigured, the user is unknown, or on any error — the
// caller then falls back to request-body overrides / file defaults.
async function loadUserConfig(userEmail) {
  if (!supabase || !userEmail) return null;
  const email = String(userEmail).trim().toLowerCase();
  if (!email) return null;
  try {
    const [entryRes, fileRes, psRes] = await Promise.all([
      supabase.from("kb_entry").select("title,content,category").eq("user_email", email),
      supabase.from("kb_file").select("filename,extracted_text,category").eq("user_email", email),
      supabase
        .from("prompt_setting")
        .select("system_prompt_append,tone")
        .eq("user_email", email)
        .maybeSingle(),
    ]);
    const entries = (entryRes && entryRes.data) || [];
    const files = (fileRes && fileRes.data) || [];
    const ps = (psRes && psRes.data) || null;

    // Group kb_entry + kb_file by category (unknown/missing category -> 'fact').
    const bucket = { fact: [], style: [], example: [] };
    for (const e of entries) {
      const cat = bucket[e.category] ? e.category : "fact";
      const text = e.title ? `## ${e.title}\n${e.content}` : String(e.content || "");
      if (text.trim()) bucket[cat].push(text.trim());
    }
    for (const f of files) {
      const cat = bucket[f.category] ? f.category : "fact";
      const text = String(f.extracted_text || "").trim();
      if (text) bucket[cat].push(`## ${f.filename}\n${text}`);
    }

    // Volume control: cap the COMBINED style+examples+facts, priority style >
    // examples > facts (truncate lowest-priority first, deterministically).
    const capped = capGuidance(
      [
        { key: "style", text: bucket.style.join("\n\n").trim() },
        { key: "examples", text: bucket.example.join("\n\n").trim() },
        { key: "facts", text: bucket.fact.join("\n\n").trim() },
      ],
      KB_GUIDANCE_CAP
    );
    if (capped.clipped) {
      console.log(`[kb] per-user guidance clipped to ${KB_GUIDANCE_CAP} chars for ${email}`);
    }

    const out = {};
    if (capped.map.style) out.style = capped.map.style;
    if (capped.map.examples) out.examples = capped.map.examples;
    if (capped.map.facts) out.facts = capped.map.facts;
    if (ps && ps.system_prompt_append) out.systemPromptAppend = ps.system_prompt_append;
    if (ps && ps.tone) out.tone = ps.tone;
    return Object.keys(out).length ? out : null;
  } catch (e) {
    console.error("supabase lookup failed:", (e && e.message) || e);
    return null;
  }
}

// Fill a total character budget across parts in priority order, truncating the
// first part that overflows and dropping the rest. Deterministic; flags clipping.
function capGuidance(parts, budget) {
  let remaining = budget;
  let clipped = false;
  const map = {};
  for (const p of parts) {
    const t = p.text || "";
    if (!t) { map[p.key] = ""; continue; }
    if (remaining <= 0) { map[p.key] = ""; clipped = true; continue; }
    if (t.length > remaining) { map[p.key] = t.slice(0, remaining); remaining = 0; clipped = true; }
    else { map[p.key] = t; remaining -= t.length; }
  }
  return { map, clipped };
}

// Durable usage/cost logging. Inserts one usage_event via the service key after a
// successful Claude call. Fire-and-forget and fully guarded — a logging failure
// must NEVER affect the /draft response.
async function logUsage(userEmail, usage, model, opts) {
  if (!supabase || !usage) return;
  try {
    const kind = (opts && opts.kind) || "draft";
    const steerSource = (opts && opts.steerSource) || null;
    // Suggest calls use the cheaper Haiku pricing; drafts use the drafting model's.
    const priceIn = kind === "suggest" ? SUGGEST_PRICE_INPUT_PER_MTOK : PRICE_INPUT_PER_MTOK;
    const priceOut = kind === "suggest" ? SUGGEST_PRICE_OUTPUT_PER_MTOK : PRICE_OUTPUT_PER_MTOK;
    const inTok = Number(usage.input_tokens) || 0;
    const outTok = Number(usage.output_tokens) || 0;
    const est = (inTok / 1e6) * priceIn + (outTok / 1e6) * priceOut;
    const email = String(userEmail || "").trim().toLowerCase() || null;
    const { error } = await supabase.from("usage_event").insert({
      user_email: email,
      input_tokens: inTok,
      output_tokens: outTok,
      model,
      est_cost_usd: Number(est.toFixed(6)),
      kind,
      steer_source: steerSource,
    });
    if (error) console.error("usage log failed:", error.message);
  } catch (e) {
    console.error("usage log failed:", (e && e.message) || e);
  }
}

// Short-window in-memory rate limit. Keyed by userEmail when present, else the
// client IP (X-Forwarded-For from Caddy, falling back to req.ip). Resets on restart.
function rateKey(req, userEmail) {
  const email = String(userEmail || "").trim().toLowerCase();
  if (email) return "u:" + email;
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return "ip:" + (xff || req.ip || "unknown");
}
function rateLimited(key) {
  const now = Date.now();
  const windowStart = now - 60000;
  const arr = (rlHits.get(key) || []).filter((t) => t > windowStart);
  if (arr.length >= RATE_LIMIT_PER_MIN) {
    rlHits.set(key, arr);
    return true;
  }
  arr.push(now);
  rlHits.set(key, arr);
  return false;
}

// Per-user daily cap over the UTC day, Supabase-backed. Returns true if the user
// is over the token OR request cap. Only applies to identified users; fails OPEN
// on any error so a DB hiccup never blocks legitimate drafting.
async function overDailyCap(userEmail) {
  if (!supabase) return false;
  const email = String(userEmail || "").trim().toLowerCase();
  if (!email) return false;
  try {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("usage_event")
      .select("input_tokens,output_tokens")
      .eq("user_email", email)
      .eq("kind", "draft")
      .gte("ts", start.toISOString());
    if (error) {
      console.error("daily cap check failed:", error.message);
      return false;
    }
    const rows = data || [];
    const tokens = rows.reduce(
      (s, r) => s + (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0),
      0
    );
    return rows.length >= DAILY_REQUEST_CAP || tokens > DAILY_TOKEN_CAP;
  } catch (e) {
    console.error("daily cap check failed:", (e && e.message) || e);
    return false;
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

// Assemble the final system prompt: optional TONE directive + editable base +
// optional per-user overrides + KB facts. Precedence on conflicting signals:
// TONE > KB style notes > KB facts. The tone directive leads the prompt (primacy)
// AND is echoed at the very end (recency), and it explicitly overrides the exact
// competing words ("friendly/casual/brief/concise"), so it reliably wins over
// style notes in the base, the append, or the KB. With no tone, the output is the
// same files-only prompt as before (no tone framing added).
async function buildSystemPrompt(overrides, userInstruction) {
  const base = await loadSystemPrompt();
  const kb = await loadKnowledgeBase();

  // Optional per-reply steer typed by the user for THIS draft only (never
  // persisted). Sits ABOVE tone/voice/facts as the immediate, highest-priority
  // instruction; tone/voice still govern HOW it's written.
  const instruction =
    typeof userInstruction === "string" ? userInstruction.trim().slice(0, INSTRUCTION_CAP) : "";

  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const hasOvr = overrides && typeof overrides === "object";
  const tone = hasOvr ? str(overrides.tone).slice(0, OVR_TONE_CAP) : "";
  const append = hasOvr ? str(overrides.systemPromptAppend).slice(0, OVR_APPEND_CAP) : "";
  const userKb = hasOvr ? str(overrides.kb).slice(0, OVR_KB_CAP) : "";
  // Category-aware per-user guidance (Supabase kb_entry + kb_file; already capped
  // in loadUserConfig). Precedence: TONE > style/examples > facts.
  const style = hasOvr ? str(overrides.style) : "";
  const examples = hasOvr ? str(overrides.examples) : "";
  const facts = hasOvr ? str(overrides.facts) : "";

  const toneDirective = tone
    ? "TONE (HIGHEST PRIORITY) — Write the entire reply in a " + tone + " register. This " +
      "instruction outranks every other style cue and OVERRIDES any guidance that says " +
      '"friendly", "casual", "brief", "concise", or similar, wherever it appears (the base ' +
      "instructions, the user instructions, or the knowledge base). Match this register even " +
      "when other notes suggest a different style."
    : "";
  const kbStyleNote = tone ? " Any note here about writing style yields to the TONE directive." : "";

  let out = "";
  // Lead with the per-reply instruction (top priority for THIS draft), then tone.
  if (instruction) {
    out +=
      "IMMEDIATE INSTRUCTION FOR THIS REPLY (highest priority) — For this specific reply, the user " +
      "has asked you to: " + instruction + " Follow this instruction for what the reply should say, " +
      "while still respecting their tone and voice settings below.\n\n===\n\n";
  }
  // Lead with the tone directive (primacy).
  if (toneDirective) out += toneDirective + "\n\n===\n\n";
  out += base;

  if (append) {
    out += "\n\n---\nAdditional instructions from the user:\n" + append;
  }
  // VOICE & STYLE — high precedence, subordinate only to the TONE directive.
  if (style) {
    out +=
      "\n\n---\nVOICE & STYLE — write the reply in the user's voice as described or demonstrated " +
      "here. High priority; subordinate ONLY to the TONE directive above.\n\n" + style;
  }
  // Few-shot EXAMPLES of the user's own writing (mimic voice, not content).
  if (examples) {
    out +=
      "\n\n---\nEXAMPLES of the user's own emails. Mimic their phrasing, rhythm, and sign-off — " +
      "NOT their specific content, recipients, or facts.\n\n" + examples;
  }
  if (kb) {
    out +=
      "\n\n---\nKnowledge base — facts about the user and their context. Use these for facts " +
      "when relevant; do not invent details beyond them." + kbStyleNote + "\n\n" + kb;
  }
  // Per-user FACTS (Supabase fact-category entries/files) — background reference.
  if (facts) {
    out +=
      "\n\n---\nAdditional facts about this user (background reference, not style)." +
      kbStyleNote + "\n\n" + facts;
  }
  if (userKb) {
    out +=
      "\n\n---\nAdditional knowledge base facts for this user (facts and context)." +
      kbStyleNote + "\n\n" + userKb;
  }
  // Echo the tone directive at the very end (recency) so it also gets last word.
  if (toneDirective) out += "\n\n===\nREMINDER — " + toneDirective;

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
    const {
      from = "",
      subject = "",
      body = "",
      userEmail = "",
      overrides,
      userInstruction,
      steer_text,
      steer_preset_id,
      steer_source,
      tone_override,
      length,
    } = req.body || {};
    if (!String(body).trim()) {
      return res.status(400).json({ error: "Email body is required." });
    }

    // Resolve the per-reply steer for THIS draft only (never persisted). Sources,
    // in precedence order:
    //   1. steer_text        — free-text typed steer (v2 free-text chip / footer)
    //   2. steer_preset_id   — a static catalog chip; server owns the steer_text
    //   3. userInstruction   — legacy field (v1 "How should I reply?"); unchanged
    // Old Outlook/Gmail payloads send none of the new fields, so `instruction`
    // resolves exactly as before and the assembled prompt is byte-identical.
    const presetText = steerTextForPreset(steer_preset_id);
    const rawSteer =
      (typeof steer_text === "string" && steer_text.trim()) ||
      presetText ||
      (typeof userInstruction === "string" ? userInstruction : "") ||
      "";
    const instruction = String(rawSteer).trim().slice(0, INSTRUCTION_CAP);

    // Where the steer came from, for usage analytics only. Trust an explicit
    // client-provided source; otherwise infer it. "none" when there is no steer.
    const KNOWN_SOURCES = ["static_chip", "smart_chip", "saved_steer", "free_text", "legacy"];
    let steerSource = "none";
    if (instruction) {
      if (typeof steer_source === "string" && KNOWN_SOURCES.includes(steer_source)) {
        steerSource = steer_source;
      } else if (steer_text && String(steer_text).trim()) {
        steerSource = "free_text";
      } else if (presetText) {
        steerSource = "static_chip";
      } else {
        steerSource = "legacy";
      }
    }

    // Optional per-reply tone + length nudges (this draft only; do not persist and
    // do not alter the user's saved tone). tone_override layers a one-off register;
    // length maps to a soft length hint woven into the drafting turn.
    const toneOverride =
      typeof tone_override === "string" ? tone_override.trim().slice(0, OVR_TONE_CAP) : "";
    const LENGTH_HINTS = {
      short: "Keep the reply short — a few sentences at most.",
      medium: "",
      long: "A slightly longer, more detailed reply is fine here.",
    };
    const lengthHint =
      typeof length === "string" && LENGTH_HINTS[length] ? LENGTH_HINTS[length] : "";

    // Cost guardrails — both return 429 and SKIP the Claude call. Clients surface
    // the { error } message (Gmail card / Outlook pane) rather than crashing.
    if (rateLimited(rateKey(req, userEmail))) {
      return res
        .status(429)
        .json({ error: "too many requests, please wait a minute and try again" });
    }
    if (await overDailyCap(userEmail)) {
      return res.status(429).json({ error: "daily limit reached, try again tomorrow" });
    }

    // Cap combined input. Raised to 16000 to fit quoted thread history in the body.
    const incoming = `From: ${from}\nSubject: ${subject}\n\n${body}`.slice(0, 16000);

    // Per-user config: a user's Supabase rows (KB + prompt/tone) supersede any
    // request-body overrides; with no user / no rows / no Supabase we fall back
    // to the request overrides, then to the mounted file defaults.
    const baseOverrides = await loadUserConfig(userEmail) || overrides;
    // A per-reply tone_override wins for THIS draft only, layered on top without
    // mutating the user's saved config. Absent -> effectiveOverrides === base.
    const effectiveOverrides = toneOverride
      ? Object.assign({}, baseOverrides || {}, { tone: toneOverride })
      : baseOverrides;

    // Fresh read of the editable prompt + KB on every request, plus the
    // effective per-user overrides and the optional per-reply instruction.
    const system = await buildSystemPrompt(effectiveOverrides, instruction);

    // Weave the tone directly into the drafting instruction in the USER turn — a
    // style constraint stated next to the task is followed far more reliably than
    // one in the system prompt, and it outweighs the base's "concise/professional"
    // default and any "friendly/brief" KB note.
    const toneVal =
      effectiveOverrides && typeof effectiveOverrides === "object" &&
      typeof effectiveOverrides.tone === "string"
        ? effectiveOverrides.tone.trim().slice(0, OVR_TONE_CAP)
        : "";
    const toneInstruction = toneVal
      ? ` Write the reply in a ${toneVal} register — this style is REQUIRED and takes ` +
        `priority over any default "concise/professional" phrasing and over any ` +
        `"friendly/casual/brief" note; do not default to a warm or casual style unless the ` +
        `tone itself is casual.`
      : "";

    // Per-reply steer stated next to the task (the most reliable spot). Governs
    // WHAT the reply should say; the tone instruction governs HOW it reads.
    const turnInstruction = instruction
      ? ` For this specific reply, the user has instructed: ${instruction}. Do this in the reply.`
      : "";

    // Optional one-off length nudge stated next to the task.
    const lengthInstruction = lengthHint ? ` ${lengthHint}` : "";

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
        messages: [
          { role: "user", content: `Draft a reply to this email.${turnInstruction}${toneInstruction}${lengthInstruction}\n\n${incoming}` },
        ],
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
    // Fire-and-forget usage/cost logging — never delays or breaks the response.
    logUsage(userEmail, data.usage, MODEL, { kind: "draft", steerSource }).catch(() => {});
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: String((e && e.message) || e) });
  }
});

// ---------------------------------------------------------------------------
// /suggest — smart steer chips. On message open the panel asks for up to three
// contextual reply intents. This endpoint is FAIL-SAFE by construction: apart
// from an auth rejection it ALWAYS returns 200 with a usable `chips` array — the
// static catalog whenever the model is slow, over budget, disabled, or errors —
// so the panel never blocks or breaks waiting on classification.
// ---------------------------------------------------------------------------

// The three static chips shown instantly on open and used as the universal
// fallback. A broadly-useful trio drawn from the catalog.
const DEFAULT_STATIC_CHIP_IDS = ["quick_thanks", "propose_time", "need_more_info"];
function staticChips() {
  const byId = new Map(publicPresets().map((p) => [p.id, p]));
  return DEFAULT_STATIC_CHIP_IDS.map((id) => {
    const p = byId.get(id);
    return { id: p.id, label: p.label, steer_text: p.steer_text, source: "static_chip" };
  });
}

// Small in-memory LRU for suggestion results, keyed by a hash of the user + the
// email content. Cuts repeat model calls when the same message is reopened
// (contextual triggers fire on every open). Bounded size + TTL; resets on restart.
const SUGGEST_LRU_MAX = 500;
const suggestCache = new Map();
function suggestCacheKey(email, incoming) {
  return crypto
    .createHash("sha256")
    .update(String(email || "").toLowerCase() + "\n" + incoming)
    .digest("hex");
}
function suggestCacheGet(key) {
  const v = suggestCache.get(key);
  if (!v) return null;
  if (v.exp < Date.now()) {
    suggestCache.delete(key);
    return null;
  }
  suggestCache.delete(key); // re-insert to mark most-recently-used
  suggestCache.set(key, v);
  return v.chips;
}
function suggestCacheSet(key, chips) {
  suggestCache.set(key, { chips, exp: Date.now() + SUGGEST_LRU_TTL_S * 1000 });
  while (suggestCache.size > SUGGEST_LRU_MAX) {
    suggestCache.delete(suggestCache.keys().next().value); // evict oldest
  }
}

// Per-user daily token cap for suggestion calls, separate from the drafting cap
// so cheap classification never eats the drafting budget. Fails OPEN on error.
async function overSuggestDailyCap(userEmail) {
  if (!supabase) return false;
  const email = String(userEmail || "").trim().toLowerCase();
  if (!email) return false;
  try {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("usage_event")
      .select("input_tokens,output_tokens")
      .eq("user_email", email)
      .eq("kind", "suggest")
      .gte("ts", start.toISOString());
    if (error) {
      console.error("suggest cap check failed:", error.message);
      return false;
    }
    const tokens = (data || []).reduce(
      (s, r) => s + (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0),
      0
    );
    return tokens > SUGGEST_DAILY_TOKEN_CAP;
  } catch (e) {
    console.error("suggest cap check failed:", (e && e.message) || e);
    return false;
  }
}

// Strict-JSON classifier prompt for Haiku. Output is validated + clamped before
// use; anything malformed makes the caller fall back to the static catalog.
const SUGGEST_SYSTEM =
  "You look at one incoming email and propose the reply intents its recipient is " +
  "most likely to want to send, as one-tap chips. Output STRICT JSON ONLY, no " +
  "prose and no markdown fences, in exactly this shape:\n" +
  '{"chips":[{"label":"...","steer_text":"..."}]}\n' +
  "Rules:\n" +
  "- 1 to 3 chips, ordered most-likely first.\n" +
  '- "label": an imperative of AT MOST 3 words naming the intent (e.g. "Accept", ' +
  '"Propose a time", "Ask for details", "Politely decline", "Say thanks").\n' +
  '- "steer_text": ONE sentence, imperative, telling the drafter what this reply ' +
  "should do. Never invent facts, names, dates, or commitments not present in the email.\n" +
  "- Cover genuinely different intents; do not return three near-duplicates.\n" +
  "Return the JSON object and nothing else.";

// Parse + validate Haiku's JSON into at most three well-formed chips. Throws when
// the output can't yield a usable chip, so the caller falls back to static.
function parseSuggestChips(text) {
  let t = String(text || "").trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1].trim();
  const obj = JSON.parse(t); // throws on non-JSON -> caught by caller
  const arr = Array.isArray(obj) ? obj : obj && Array.isArray(obj.chips) ? obj.chips : null;
  if (!arr) throw new Error("suggest: no chips array");
  const chips = [];
  for (const c of arr) {
    if (!c) continue;
    const label = String(c.label || "").trim().split(/\s+/).slice(0, 3).join(" ");
    const steer = String(c.steer_text || "").trim().slice(0, INSTRUCTION_CAP);
    if (label && steer) {
      chips.push({ id: "smart_" + chips.length, label, steer_text: steer, source: "smart_chip" });
    }
    if (chips.length === 3) break;
  }
  if (!chips.length) throw new Error("suggest: empty after validation");
  return chips;
}

// Call Haiku with a HARD server-side deadline (AbortController). UrlFetchApp has
// no per-call timeout, so this deadline is the only thing keeping the panel snappy.
async function classifyWithHaiku(incoming) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: SUGGEST_MODEL,
        max_tokens: 300,
        system: SUGGEST_SYSTEM,
        messages: [{ role: "user", content: incoming }],
      }),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error("suggest api " + r.status);
    const data = await r.json();
    const text = (data.content && data.content[0] && data.content[0].text) || "";
    return { chips: parseSuggestChips(text), usage: data.usage };
  } finally {
    clearTimeout(timer);
  }
}

app.post("/suggest", async (req, res) => {
  try {
    if (!requireAuth(req)) return res.status(401).json({ error: "Unauthorized" });
    const { from = "", subject = "", body = "", userEmail = "" } = req.body || {};
    // Empty body -> nothing to classify; still 200 so the panel renders chips.
    if (!String(body).trim()) return res.json({ source: "static", chips: staticChips() });

    const incoming = `From: ${from}\nSubject: ${subject}\n\n${body}`.slice(0, 16000);

    // Cache hit: instant, no model call, no metering.
    const key = suggestCacheKey(userEmail, incoming);
    const cached = suggestCacheGet(key);
    if (cached) return res.json({ source: "smart", chips: cached, cached: true });

    // Guardrails — over any of these, fall back to static SILENTLY (still 200).
    // Suggest has its own rate bucket + daily cap, decoupled from drafting.
    if (
      !KEY ||
      rateLimited("suggest:" + rateKey(req, userEmail)) ||
      (await overSuggestDailyCap(userEmail))
    ) {
      return res.json({ source: "static", chips: staticChips() });
    }

    try {
      const { chips, usage } = await classifyWithHaiku(incoming);
      suggestCacheSet(key, chips);
      logUsage(userEmail, usage, SUGGEST_MODEL, { kind: "suggest" }).catch(() => {});
      return res.json({ source: "smart", chips });
    } catch (e) {
      // Timeout / abort / non-200 / bad JSON — silent static fallback.
      return res.json({ source: "static", chips: staticChips() });
    }
  } catch (e) {
    // Last resort: never 500 the panel.
    return res.json({ source: "static", chips: staticChips() });
  }
});

// ---------------------------------------------------------------------------
// /steers — a user's saved steers (managed in the dashboard), for the add-on to
// render as extra chips. Read-only from the client's perspective; writes happen
// in the dashboard under RLS. Fail-safe: always 200 with a `steers` array (empty
// when Supabase is off, the user is unknown, or on any error).
// ---------------------------------------------------------------------------
async function loadSavedSteers(userEmail) {
  if (!supabase) return [];
  const email = String(userEmail || "").trim().toLowerCase();
  if (!email) return [];
  try {
    const { data, error } = await supabase
      .from("saved_steers")
      .select("id,label,steer_text,sort_order")
      .eq("user_email", email)
      .order("sort_order", { ascending: true })
      .limit(10);
    if (error) {
      console.error("saved steers load failed:", error.message);
      return [];
    }
    return (data || []).map((r) => ({
      id: r.id,
      label: String(r.label || "").slice(0, 40),
      steer_text: String(r.steer_text || "").slice(0, INSTRUCTION_CAP),
    }));
  } catch (e) {
    console.error("saved steers load failed:", (e && e.message) || e);
    return [];
  }
}

app.post("/steers", async (req, res) => {
  try {
    if (!requireAuth(req)) return res.status(401).json({ error: "Unauthorized" });
    const { userEmail = "" } = req.body || {};
    return res.json({ steers: await loadSavedSteers(userEmail) });
  } catch (e) {
    return res.json({ steers: [] });
  }
});

// Boot-time env self-check. Logs the NAMES of missing/placeholder/malformed
// required vars (never values) so a silent misconfig is visible in the container
// logs instead of surfacing later as a mystery 401/500/empty-config. Catches the
// classic footguns: an unset ANTHROPIC_API_KEY, an open /draft (no API_SECRET),
// and a masked/truncated SUPABASE_SERVICE_KEY (the • / non-JWT paste bug).
function checkEnv() {
  const bad = (v) => !v || /^(replace_me|changeme|your[-_]|xxxx)/i.test(v) || /[•·]/.test(v);
  const missing = [];
  const warn = [];

  if (bad(KEY)) missing.push("ANTHROPIC_API_KEY (unset/placeholder)");
  else if (!/^sk-ant-/.test(KEY)) warn.push("ANTHROPIC_API_KEY (unexpected format — expected sk-ant-…)");

  if (bad(process.env.API_SECRET)) {
    warn.push("API_SECRET (unset — /draft accepts any caller with the URL; set it before sharing)");
  }
  if (bad(process.env.SUPABASE_URL)) warn.push("SUPABASE_URL (unset — per-user config disabled, files-only)");
  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (bad(svc)) warn.push("SUPABASE_SERVICE_KEY (unset/placeholder — per-user config disabled)");
  else if (!(svc.startsWith("eyJ") && svc.split(".").length === 3)) {
    warn.push("SUPABASE_SERVICE_KEY (not a valid JWT — likely masked/truncated; re-copy the real key)");
  }

  if (missing.length) console.error("[boot] REQUIRED env missing/invalid:", missing.join("; "));
  if (warn.length) console.warn("[boot] env warnings:", warn.join("; "));
  if (!missing.length && !warn.length) console.log("[boot] env self-check: all required vars present and well-formed");

  // Smart-chip (/suggest) configuration is always optional — the endpoint falls
  // back to the static catalog — so just echo the resolved knobs for visibility.
  console.log(
    "[boot] suggest: model=" + SUGGEST_MODEL +
      " timeout=" + SUGGEST_TIMEOUT_MS + "ms" +
      " dailyTokenCap=" + SUGGEST_DAILY_TOKEN_CAP +
      " lruTtl=" + SUGGEST_LRU_TTL_S + "s"
  );
}

checkEnv();
app.listen(PORT, () => console.log(`reply-drafter listening on :${PORT} (model ${MODEL})`));
