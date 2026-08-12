// Backward-compat unit tests for the v2 steer plumbing. No test framework (keeps
// the dependency tree minimal per CLAUDE.md) — plain Node + assert. Run with:
//   node server/test/prompt-assembly.test.js
//
// The contract under test: a PRE-V2 payload (from/subject/body [+ userInstruction
// + overrides], none of the new steer_* / tone_override / length fields) must
// resolve and assemble EXACTLY as before — same steer, byte-identical user turn,
// and a system prompt whose ordering is unchanged with no v2-only text leaking in.
const assert = require("assert");
const { resolveSteer, buildDraftTurn, buildSystemPrompt } = require("../index.js");
const { steerTextForPreset } = require("../steerCatalog.js");

let passed = 0;
const ok = (name) => { passed++; console.log("  ✓ " + name); };

(async () => {
  // ---- resolveSteer: precedence + backward compatibility ----
  assert.deepStrictEqual(
    resolveSteer({}), { instruction: "", steerSource: "none" },
    "empty payload -> no steer"
  );
  ok("no steer -> { '', none }");

  assert.deepStrictEqual(
    resolveSteer({ userInstruction: "keep it brief" }),
    { instruction: "keep it brief", steerSource: "legacy" },
    "legacy userInstruction only"
  );
  ok("legacy userInstruction -> instruction preserved, source=legacy");

  // free_text (steer_text) wins over preset AND legacy.
  assert.deepStrictEqual(
    resolveSteer({ steer_text: "say yes", steer_preset_id: "accept", userInstruction: "x" }),
    { instruction: "say yes", steerSource: "free_text" },
    "steer_text outranks preset + legacy"
  );
  ok("steer_text precedence over preset + legacy");

  // preset resolves to the catalog text; source static_chip.
  assert.deepStrictEqual(
    resolveSteer({ steer_preset_id: "accept" }),
    { instruction: steerTextForPreset("accept"), steerSource: "static_chip" },
    "preset resolves to catalog steer_text"
  );
  ok("preset -> catalog steer_text, source=static_chip");

  // explicit, KNOWN source is trusted (saved steers ride steer_text + saved_steer).
  assert.strictEqual(
    resolveSteer({ steer_text: "decline warmly", steer_source: "saved_steer" }).steerSource,
    "saved_steer", "known explicit source trusted"
  );
  ok("explicit known steer_source honored");

  // unknown source is ignored -> inferred (free_text here).
  assert.strictEqual(
    resolveSteer({ steer_text: "hi", steer_source: "bogus" }).steerSource,
    "free_text", "unknown source ignored, inferred"
  );
  ok("unknown steer_source ignored -> inferred");

  // unknown preset id + no text, but legacy present -> legacy.
  assert.deepStrictEqual(
    resolveSteer({ steer_preset_id: "nope", userInstruction: "z" }),
    { instruction: "z", steerSource: "legacy" },
    "unknown preset falls through to legacy"
  );
  ok("unknown preset id -> falls through to legacy");

  // INSTRUCTION_CAP (2000) is enforced.
  assert.strictEqual(
    resolveSteer({ userInstruction: "a".repeat(5000) }).instruction.length, 2000,
    "instruction capped at 2000"
  );
  ok("instruction capped at INSTRUCTION_CAP");

  // ---- buildDraftTurn: byte-identical legacy turn ----
  assert.strictEqual(
    buildDraftTurn({ incoming: "BODY" }),
    "Draft a reply to this email.\n\nBODY",
    "no-steer turn is unchanged"
  );
  ok("no-steer user turn byte-identical");

  assert.strictEqual(
    buildDraftTurn({ instruction: "keep it brief", incoming: "BODY" }),
    "Draft a reply to this email. For this specific reply, the user has instructed: keep it brief. Do this in the reply.\n\nBODY",
    "legacy-steer turn is unchanged"
  );
  ok("legacy-steer user turn byte-identical");

  // length is purely additive: a legacy (no-length) turn equals the v2 turn with
  // the length segment removed, proving `length` never alters pre-v2 output.
  const base = buildDraftTurn({ instruction: "do X", tone: "formal", incoming: "BODY" });
  const withLen = buildDraftTurn({ instruction: "do X", tone: "formal", lengthHint: "Keep it short.", incoming: "BODY" });
  assert.strictEqual(withLen.replace(" Keep it short.", ""), base, "length is additive-only");
  ok("length nudge is additive (no effect when absent)");

  // ---- buildSystemPrompt: ordering + no v2 leakage + legacy identity ----
  const ovr = { tone: "formal", systemPromptAppend: "APPEND_MARK", style: "STYLE_MARK" };
  const sys = await buildSystemPrompt(ovr, "INSTR_MARK");
  const idx = (s) => sys.indexOf(s);
  assert.ok(idx("IMMEDIATE INSTRUCTION FOR THIS REPLY") >= 0, "instruction block present");
  assert.ok(
    idx("IMMEDIATE INSTRUCTION FOR THIS REPLY") < idx("TONE (HIGHEST PRIORITY)"),
    "instruction precedes tone"
  );
  assert.ok(idx("TONE (HIGHEST PRIORITY)") < idx("You are drafting"), "tone precedes base");
  assert.ok(idx("You are drafting") < idx("APPEND_MARK"), "base precedes append");
  assert.ok(idx("APPEND_MARK") < idx("STYLE_MARK"), "append precedes voice/style");
  assert.ok(idx("STYLE_MARK") < sys.lastIndexOf("REMINDER"), "style precedes the tone reminder");
  ok("system prompt ordering: instruction < tone < base < append < style < reminder");

  // No v2-only turn text ever leaks into the SYSTEM prompt.
  assert.ok(!/Keep the reply short|more detailed reply is fine/.test(sys), "no length text in system prompt");
  ok("no length-hint text leaks into the system prompt");

  // The resolveSteer indirection doesn't change what reaches assembly: a legacy
  // payload assembles identically whether the instruction is passed raw or via
  // resolveSteer.
  const viaResolve = await buildSystemPrompt(ovr, resolveSteer({ userInstruction: "INSTR_MARK" }).instruction);
  assert.strictEqual(viaResolve, sys, "legacy path assembles identically through resolveSteer");
  ok("legacy assembles identically via resolveSteer");

  console.log(`\nAll ${passed} assertions passed.`);
})().catch((e) => {
  console.error("\nTEST FAILED:", e && e.message ? e.message : e);
  process.exit(1);
});
