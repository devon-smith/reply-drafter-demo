import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { card, h2, input, btn, btnGhost, muted } from "../styles.js";

// List / create / delete the caller's kb_entry rows. RLS ensures a user only
// ever sees and mutates their own rows; we still set user_email explicitly on
// insert so the WITH CHECK policy passes.
export default function KbManager({ email }) {
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("kb_entry")
      .select("id,title,content,created_at")
      .order("created_at", { ascending: true });
    if (!error) setRows(data || []);
  }

  useEffect(() => {
    load();
  }, [email]);

  async function add(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setStatus("Adding…");
    const { error } = await supabase
      .from("kb_entry")
      .insert({ user_email: email, title: title.trim() || null, content: content.trim() });
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    setTitle("");
    setContent("");
    setStatus("");
    load();
  }

  async function remove(id) {
    await supabase.from("kb_entry").delete().eq("id", id);
    load();
  }

  return (
    <section style={card}>
      <h2 style={h2}>Knowledge base</h2>
      <p style={{ ...muted, marginTop: 0 }}>
        Facts your drafts can rely on (name, sign-off, context).
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {rows.map((r) => (
          <li key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}>
            <div>
              {r.title && <strong>{r.title}: </strong>}
              <span>{r.content}</span>
            </div>
            <button onClick={() => remove(r.id)} style={btnGhost}>Delete</button>
          </li>
        ))}
        {rows.length === 0 && <li style={{ color: "var(--ink-muted)" }}>No entries yet.</li>}
      </ul>
      <form onSubmit={add}>
        <input style={input} value={title} placeholder="Title (optional)" onChange={(e) => setTitle(e.target.value)} />
        <textarea
          style={{ ...input, minHeight: 60 }}
          value={content}
          placeholder="Fact / note"
          onChange={(e) => setContent(e.target.value)}
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <button type="submit" style={btn}>Add entry</button>
          <span style={muted}>{status}</span>
        </div>
      </form>
    </section>
  );
}
