import { useEffect, useRef, useState } from "react";
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

// Autosaves the caller's single prompt_setting row (RLS scopes it to them).
// Text fields debounce (~800ms after typing stops); tone chips save immediately.
// Status shows Saving… / Saved / an error so the user knows it persisted.
export default function PromptSettings({ email }) {
  const [tone, setTone] = useState("");
  const [append, setAppend] = useState("");
  const [status, setStatus] = useState(""); // "" | "saving" | "saved" | "error:<msg>"
  const debounceRef = useRef(null);
  const savedTimerRef = useRef(null);

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

  async function persist(nextTone, nextAppend) {
    clearTimeout(savedTimerRef.current);
    setStatus("saving");
    const { error } = await supabase.from("prompt_setting").upsert({
      user_email: email,
      tone: nextTone,
      system_prompt_append: nextAppend,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setStatus("error:" + (error.message || "save failed"));
    } else {
      setStatus("saved");
      savedTimerRef.current = setTimeout(() => setStatus(""), 1600);
    }
  }

  // Debounced save for the free-text fields; immediate save for chips.
  function debouncedSave(nextTone, nextAppend) {
    clearTimeout(debounceRef.current);
    setStatus("saving");
    debounceRef.current = setTimeout(() => persist(nextTone, nextAppend), 800);
  }
  function saveNow(nextTone, nextAppend) {
    clearTimeout(debounceRef.current);
    persist(nextTone, nextAppend);
  }

  // Keep honoring the global save event (⌘S) as an immediate flush.
  useEffect(() => {
    const onSave = () => saveNow(tone, append);
    window.addEventListener("dashboard:save", onSave);
    return () => window.removeEventListener("dashboard:save", onSave);
  }, [tone, append, email]);

  // Clear any pending timers on unmount.
  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    clearTimeout(savedTimerRef.current);
  }, []);

  const statusEl =
    status === "saving" ? (
      <span style={muted}>Saving…</span>
    ) : status === "saved" ? (
      <span style={{ color: "var(--ok)", fontSize: 14 }}>Saved</span>
    ) : status.startsWith("error:") ? (
      <span style={{ color: "var(--danger)", fontSize: 14 }}>Couldn't save — {status.slice(6)}</span>
    ) : (
      <span>&nbsp;</span>
    );

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
              onClick={() => { setTone(p.value); saveNow(p.value, append); }}
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
      <input
        style={input}
        value={tone}
        placeholder="e.g. warm and brief"
        onChange={(e) => { const v = e.target.value; setTone(v); debouncedSave(v, append); }}
      />

      <label style={label}>Extra instructions</label>
      <textarea
        style={{ ...input, minHeight: 96, lineHeight: 1.5 }}
        value={append}
        placeholder="e.g. Never use exclamation marks."
        onChange={(e) => { const v = e.target.value; setAppend(v); debouncedSave(tone, v); }}
      />
      <div style={{ marginTop: 10, minHeight: 18 }}>{statusEl}</div>
    </section>
  );
}
