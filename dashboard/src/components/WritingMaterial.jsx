import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { extractText } from "../extract.js";
import { card, h2, btn, btnGhost, muted } from "../styles.js";

// Upload writing material (past emails, a style note, a doc). We extract the text
// in the browser and store it so drafts sound like you — no categories to pick;
// everything uploaded is treated as voice/style guidance by the backend.
const EXTRACT_CAP = 50000; // per-file stored text cap (backend caps injection again)

export default function WritingMaterial({ email }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function load() {
    const { data, error } = await supabase
      .from("kb_file")
      .select("id,filename,storage_path,created_at")
      .order("created_at", { ascending: true });
    if (!error) setRows(data || []);
  }

  useEffect(() => {
    load();
  }, [email]);

  async function onUpload(e) {
    e.preventDefault();
    const files = fileRef.current && fileRef.current.files ? Array.from(fileRef.current.files) : [];
    if (!files.length) return;
    setBusy(true);
    let added = 0;
    const failed = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setStatus(`Reading “${file.name}”… (${i + 1}/${files.length})`);
        const text = (await extractText(file)).slice(0, EXTRACT_CAP);
        if (!text) { failed.push(`${file.name} (no text)`); continue; }
        // Store under the user's own path (RLS: first segment = email); index +
        // timestamp keeps paths unique even within one batch.
        const path = `${email}/${Date.now()}-${i}-${file.name}`;
        const up = await supabase.storage.from("kb-files").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        const ins = await supabase.from("kb_file").insert({
          user_email: email,
          filename: file.name,
          storage_path: path,
          category: "style",
          extracted_text: text,
        });
        if (ins.error) throw ins.error;
        added++;
      } catch (err) {
        failed.push(`${file.name}: ${err && err.message ? err.message : err}`);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    setStatus(
      `Added ${added} file${added === 1 ? "" : "s"}` +
        (failed.length ? ` — failed: ${failed.join("; ")}` : ".")
    );
    setBusy(false);
    load();
  }

  async function remove(row) {
    setStatus("Removing…");
    await supabase.storage.from("kb-files").remove([row.storage_path]);
    await supabase.from("kb_file").delete().eq("id", row.id);
    setStatus("");
    load();
  }

  return (
    <section style={card}>
      <h2 style={h2}>Writing material</h2>
      <p style={{ ...muted, marginTop: 0 }}>
        Upload past emails or a note about how you write (.txt, .md, or .pdf). Drafts will pick up
        your voice. No need to label anything.
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {rows.map((r) => (
          <li key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
            <span>{r.filename}</span>
            <button onClick={() => remove(r)} style={btnGhost}>Delete</button>
          </li>
        ))}
        {rows.length === 0 && <li style={{ color: "#999" }}>No files yet.</li>}
      </ul>
      <form onSubmit={onUpload}>
        <input ref={fileRef} type="file" multiple accept=".txt,.md,.text,.pdf" disabled={busy} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <button type="submit" style={btn} disabled={busy}>{busy ? "Working…" : "Upload"}</button>
          <span style={muted}>{status}</span>
        </div>
      </form>
    </section>
  );
}
