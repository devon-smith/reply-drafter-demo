import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { card, kicker, h2, input, btn, btnGhost, muted } from "../styles.js";

const MAX_STEERS = 10;

// List / create / delete the caller's saved_steers rows. RLS scopes every query
// to the signed-in user; we still set user_email explicitly on insert so the
// WITH CHECK policy passes. The 10-per-user cap is enforced in the database (a
// trigger) — we mirror it in the UI so the button disables before the insert fails.
export default function SavedSteers({ email }) {
  const [rows, setRows] = useState([]);
  const [label, setLabel] = useState("");
  const [steerText, setSteerText] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("saved_steers")
      .select("id,label,steer_text,sort_order,created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error) setRows(data || []);
  }

  useEffect(() => {
    load();
  }, [email]);

  async function add(e) {
    e.preventDefault();
    if (!label.trim() || !steerText.trim()) return;
    if (rows.length >= MAX_STEERS) {
      setStatus(`Limit reached — max ${MAX_STEERS} saved steers.`);
      return;
    }
    setStatus("Adding…");
    const { error } = await supabase.from("saved_steers").insert({
      user_email: email,
      label: label.trim().slice(0, 40),
      steer_text: steerText.trim(),
      sort_order: rows.length,
    });
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    setLabel("");
    setSteerText("");
    setStatus("");
    load();
  }

  async function remove(id) {
    await supabase.from("saved_steers").delete().eq("id", id);
    load();
  }

  const atCap = rows.length >= MAX_STEERS;

  return (
    <section style={card}>
      <span style={kicker}>Reusable</span>
      <h2 style={h2}>Saved steers</h2>
      <p style={{ ...muted, marginTop: 0 }}>
        One-tap reply intents that show as chips in the Gmail add-on. Give each a
        short chip label and the instruction it should send. Up to {MAX_STEERS}.
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {rows.map((r) => (
          <li key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
            <div style={{ minWidth: 0 }}>
              <strong>{r.label}</strong>
              <div style={{ ...muted, marginTop: 2 }}>{r.steer_text}</div>
            </div>
            <button onClick={() => remove(r.id)} style={btnGhost}>Delete</button>
          </li>
        ))}
        {rows.length === 0 && <li style={{ color: "var(--ink-muted)" }}>No saved steers yet.</li>}
      </ul>
      <form onSubmit={add}>
        <input
          style={input}
          value={label}
          maxLength={40}
          placeholder="Chip label (e.g. Decline politely)"
          onChange={(e) => setLabel(e.target.value)}
        />
        <textarea
          style={{ ...input, minHeight: 60, marginTop: 8 }}
          value={steerText}
          placeholder="What the reply should do (e.g. Decline the invite warmly and suggest reconnecting later)"
          onChange={(e) => setSteerText(e.target.value)}
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <button type="submit" style={{ ...btn, opacity: atCap ? 0.5 : 1, cursor: atCap ? "not-allowed" : "pointer" }} disabled={atCap}>
            Add steer
          </button>
          <span style={muted}>{status || (atCap ? `Max ${MAX_STEERS} reached.` : `${rows.length}/${MAX_STEERS}`)}</span>
        </div>
      </form>
    </section>
  );
}
