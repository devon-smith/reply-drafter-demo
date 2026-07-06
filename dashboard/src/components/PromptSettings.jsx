import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { card, kicker, h2, label, input, muted } from "../styles.js";

// Quick tone presets — clicking one fills the tone field. Highlighted when the
// saved tone matches the preset phrase exactly.
const PRESETS = [
  { label: "Warm & concise", value: "warm and concise" },
  { label: "Direct", value: "direct and to the point" },
  { label: "Playful", value: "playful and warm" },
  { label: "Formal", value: "formal and professional" },
];

// Edits the caller's single prompt_setting row (RLS scopes it to them). Save is
// driven from the top-bar "Save changes" button (and ⌘S) via a dispatched event.
export default function PromptSettings({ email }) {
  const [tone, setTone] = useState("");
  const [append, setAppend] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    supabase
      .from("prompt_setting")
      .select("system_prompt_append,tone")
      .eq("user_email", email)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTone(data.tone || "");
          setAppend(data.system_prompt_append || "");
        }
      });
  }, [email]);

  async function save() {
    setStatus("Saving…");
    const { error } = await supabase.from("prompt_setting").upsert({
      user_email: email,
      tone,
      system_prompt_append: append,
      updated_at: new Date().toISOString(),
    });
    setStatus(error ? "Error: " + error.message : "Saved.");
  }

  // Honor the global ⌘S / top-bar "Save changes" event while this panel is mounted.
  useEffect(() => {
    const onSave = () => save();
    window.addEventListener("dashboard:save", onSave);
    return () => window.removeEventListener("dashboard:save", onSave);
  }, [tone, append, email]);

  return (
    <section style={card}>
      <span style={kicker}>Voice</span>
      <h2 style={h2}>Prompt &amp; tone</h2>
      <p style={{ ...muted, marginTop: 0 }}>How your drafts read. Tone leads, then your writing material, then facts.</p>

      <label style={label}>Tone</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {PRESETS.map((p) => {
          const on = tone.trim().toLowerCase() === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => { setTone(p.value); setStatus(""); }}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                background: on ? "var(--accent-soft)" : "transparent",
                border: `1px solid ${on ? "var(--accent)" : "var(--hairline-strong)"}`,
                color: on ? "var(--ink)" : "var(--ink-2)",
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <input style={input} value={tone} placeholder="e.g. warm and brief" onChange={(e) => { setTone(e.target.value); setStatus(""); }} />

      <label style={label}>Extra instructions</label>
      <textarea
        style={{ ...input, minHeight: 96, lineHeight: 1.5 }}
        value={append}
        placeholder="e.g. Never use exclamation marks."
        onChange={(e) => { setAppend(e.target.value); setStatus(""); }}
      />
      <div style={{ ...muted, marginTop: 10, minHeight: 18 }}>{status}</div>
    </section>
  );
}
