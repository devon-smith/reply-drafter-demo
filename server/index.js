// Reply Drafter backend. Express + native fetch (Node 20). No SDK, no dotenv
// (env comes from docker compose env_file). Plain HTTP behind Caddy.
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const KEY = process.env.ANTHROPIC_API_KEY;

app.use(express.json({ limit: "1mb" }));

// Serve the add-in's static files (taskpane.html, css, manifest, icons) from the
// repo root. express.static ignores dotfiles by default, so .env is NOT served.
app.use(express.static(path.join(__dirname, "..")));

app.get("/health", (req, res) => {
  res.json({ status: "ok", model: MODEL, keyConfigured: Boolean(KEY) });
});

const SYSTEM_PROMPT =
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
        system: SYSTEM_PROMPT,
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
