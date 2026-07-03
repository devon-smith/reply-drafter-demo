// Reply Drafter backend. Express + native fetch (Node 20). No SDK, no dotenv
// (env comes from docker compose env_file). Plain HTTP behind Caddy.
const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const KEY = process.env.ANTHROPIC_API_KEY;

// Editable prompt + knowledge base. Both live at the repo root and are mounted
// as compose volumes, so they can be edited without a rebuild — we read them
// FRESH on every request. Missing/empty/unreadable files fall back safely.
const ROOT = path.join(__dirname, "..");
const PROMPT_PATH = path.join(ROOT, "prompt", "system.md");
const KB_DIR = path.join(ROOT, "kb");
const KB_CAP = 8000; // max chars of KB facts injected into the prompt

app.use(express.json({ limit: "1mb" }));

// Serve the add-in's static files (taskpane.html, css, manifest, icons) from the
// repo root. express.static ignores dotfiles by default, so .env is NOT served.
app.use(express.static(path.join(__dirname, "..")));

app.get("/health", (req, res) => {
  res.json({ status: "ok", model: MODEL, keyConfigured: Boolean(KEY) });
});

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

// Assemble the final system prompt: editable base + optional KB facts block.
async function buildSystemPrompt() {
  const base = await loadSystemPrompt();
  const kb = await loadKnowledgeBase();
  if (!kb) return base;
  return (
    base +
    "\n\n---\nKnowledge base — facts about the user and their context. Use these " +
    "when relevant to the reply; do not invent details beyond them.\n\n" +
    kb
  );
}

app.post("/draft", async (req, res) => {
  try {
    if (!KEY) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on the server." });
    }
    const { from = "", subject = "", body = "" } = req.body || {};
    if (!String(body).trim()) {
      return res.status(400).json({ error: "Email body is required." });
    }
    // Cap combined input. Raised to 16000 to fit quoted thread history in the body.
    const incoming = `From: ${from}\nSubject: ${subject}\n\n${body}`.slice(0, 16000);

    // Fresh read of the editable prompt + KB on every request.
    const system = await buildSystemPrompt();

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
