import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { card, kicker, h2, label, input, btn, muted } from "../styles.js";

// Edits the caller's single prompt_setting row (RLS scopes it to them).
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

  // Honor the global ⌘S save shortcut dispatched by App while this panel is mounted.
  useEffect(() => {
    const onSave = () => save();
    window.addEventListener("dashboard:save", onSave);
    return () => window.removeEventListener("dashboard:save", onSave);
  }, [tone, append, email]);

  return (
    <section style={card}>
      <span style={kicker}>Voice</span>
      <h2 style={h2}>Prompt &amp; tone</h2>
      <p style={{ ...muted, marginTop: 0 }}>How your drafts should sound.</p>
      <label style={label}>Tone</label>
      <input style={input} value={tone} placeholder="e.g. warm and brief" onChange={(e) => setTone(e.target.value)} />
      <label style={label}>Extra instructions</label>
      <textarea
        style={{ ...input, minHeight: 96, lineHeight: 1.5 }}
        value={append}
        placeholder="e.g. Never use exclamation marks."
        onChange={(e) => setAppend(e.target.value)}
      />
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
        <button onClick={save} style={btn}>Save</button>
        <span style={muted}>{status}</span>
      </div>
    </section>
  );
}
