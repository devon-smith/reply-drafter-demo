// Runnable acceptance harness for the two v2 ACs that can't be checked off-box:
//   1. Chip quality: >=16 of 20 emails return a "tap-worthy" set of smart chips.
//   2. Latency: p95 of the /suggest round trip is <= 3.5s (the model+network part
//      of panel render; the Gmail card render adds a little on top).
//
// Run AFTER `clasp push` to HEAD, against the live backend, BEFORE promoting the
// published deployment to the family. If it fails, flip SUGGEST_ENABLED='false'
// (Script Property) and you've still shipped a better card with static chips.
//
// Usage:
//   SUGGEST_URL=https://reply-devon.duckdns.org/suggest \
//   API_SECRET=<the backend secret> \
//   node server/scripts/suggest-eval.mjs [--runs N] [--bust]
//
//   --runs N  repeat the 20-email sweep N times for a larger latency sample (default 1)
//   --bust    append a unique nonce to each body to defeat the server LRU cache and
//             measure COLD (worst-case) model latency. Omit to measure realistic
//             latency where reopens are cache hits (~0ms).
//
// The tap-worthy judgment (AC #1) is human: the script prints each email's chips
// and tallies smart vs static, then asks you to eyeball how many are genuinely
// useful. It computes latency (AC #2) automatically.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SUGGEST_URL || "https://reply-devon.duckdns.org/suggest";
const SECRET = process.env.API_SECRET || process.env.DRAFT_SECRET || "";
const args = process.argv.slice(2);
const RUNS = Math.max(1, Number((args[args.indexOf("--runs") + 1]) || 1) || 1);
const BUST = args.includes("--bust");

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

async function main() {
  const emails = JSON.parse(await readFile(path.join(__dir, "fixtures", "emails.json"), "utf8"));
  console.log(`Eval: ${emails.length} emails × ${RUNS} run(s) → ${URL}`);
  console.log(`Cache: ${BUST ? "BUSTED (cold model latency)" : "enabled (realistic)"}  Auth: ${SECRET ? "x-api-key set" : "no secret"}\n`);

  const latencies = [];
  let smart = 0, staticCount = 0, errors = 0;
  const perEmailSmart = new Map();

  for (let run = 0; run < RUNS; run++) {
    for (const e of emails) {
      const nonce = BUST ? `\n\n[eval ${run}-${Math.random().toString(36).slice(2)}]` : "";
      const payload = { from: e.from, subject: e.subject, body: e.body + nonce, userEmail: "eval@local" };
      const t0 = performance.now();
      let res, json;
      try {
        res = await fetch(URL, {
          method: "POST",
          headers: { "content-type": "application/json", ...(SECRET ? { "x-api-key": SECRET } : {}) },
          body: JSON.stringify(payload),
        });
        json = await res.json();
      } catch (err) {
        errors++;
        console.log(`  ✗ ${e.id}: request failed — ${err.message}`);
        continue;
      }
      const ms = performance.now() - t0;
      latencies.push(ms);
      const isSmart = json.source === "smart";
      if (isSmart) smart++; else staticCount++;
      if (isSmart) perEmailSmart.set(e.id, true);
      else if (!perEmailSmart.has(e.id)) perEmailSmart.set(e.id, false);

      if (run === 0) {
        const chips = (json.chips || []).map((c) => c.label).join(" · ");
        console.log(`  ${isSmart ? "◆" : "○"} ${e.id.padEnd(24)} ${Math.round(ms).toString().padStart(5)}ms  [${chips}]`);
      }
    }
  }

  const smartEmails = [...perEmailSmart.values()].filter(Boolean).length;
  console.log("\n─────────────────────────────────────────────");
  console.log(`Requests:        ${latencies.length} ok, ${errors} errors`);
  console.log(`Smart responses: ${smart}   Static fallbacks: ${staticCount}`);
  console.log(`Emails with smart chips: ${smartEmails}/${perEmailSmart.size}`);
  console.log("");
  console.log("Latency (ms):");
  console.log(`  p50 ${Math.round(pct(latencies, 50))}   p90 ${Math.round(pct(latencies, 90))}   p95 ${Math.round(pct(latencies, 95))}   max ${Math.round(Math.max(0, ...latencies))}`);
  console.log("");

  const p95 = pct(latencies, 95);
  const latencyPass = p95 <= 3500;
  console.log(`AC — latency p95 ≤ 3500ms:   ${latencyPass ? "PASS" : "FAIL"} (p95 = ${Math.round(p95)}ms)`);
  console.log(`AC — chip quality ≥16/20:    MANUAL — ${smartEmails}/20 returned smart chips.`);
  console.log(`   Eyeball the chip lists above: mark each email tap-worthy if a chip`);
  console.log(`   matches the reply you'd actually send. Need ≥16 tap-worthy to pass.`);
  console.log("─────────────────────────────────────────────");
  if (!latencyPass) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
