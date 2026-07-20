import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { extractText } from "../extract.js";
import { card, kicker, h2, btnGhost, muted, mono } from "../styles.js";

// Upload writing material (past emails, a style note, a doc). We extract the text
// in the browser and store it so drafts sound like you — no categories to pick;
// everything uploaded is treated as voice/style guidance by the backend.
// Files upload immediately on selection (no separate Upload button).
const EXTRACT_CAP = 50000; // per-file stored text cap (backend caps injection again)

export default function WritingMaterial({ email }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

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

  // Auto-upload as soon as files are chosen.
  async function onFilesChosen(e) {
    const inputEl = e.target;
    const files = inputEl.files ? Array.from(inputEl.files) : [];
    if (!files.length) return;
    setBusy(true);
    setFailed(false);
    let added = 0;
    const errors = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setStatus(`Uploading “${file.name}”… (${i + 1}/${files.length})`);
        const text = (await extractText(file)).slice(0, EXTRACT_CAP);
        if (!text) { errors.push(`${file.name} (no readable text)`); continue; }
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
        errors.push(`${file.name}: ${err && err.message ? err.message : err}`);
      }
    }
    inputEl.value = ""; // reset so the same file can be re-selected
    setFailed(errors.length > 0);
    setStatus(
      `Added ${added} file${added === 1 ? "" : "s"}` +
        (errors.length ? ` — failed: ${errors.join("; ")}` : ".")
    );
    setBusy(false);
    load();
  }

  async function remove(row) {
    setStatus("Removing…");
    setFailed(false);
    await supabase.storage.from("kb-files").remove([row.storage_path]);
    await supabase.from("kb_file").delete().eq("id", row.id);
    setStatus("");
    load();
  }

  return (
    <section style={card}>
      <span style={kicker}>Voice</span>
      <h2 style={h2}>Writing material</h2>
      <p style={{ ...muted, marginTop: 0 }}>
        Upload past emails or a note about how you write (.txt, .md, or .pdf) — it uploads as soon as
        you pick it, and drafts will pick up your voice. No need to label anything.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0" }}>
        {rows.map((r) => (
          <li key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
            <span style={{ ...mono, fontSize: 13, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.filename}</span>
            <button onClick={() => remove(r)} style={btnGhost}>Delete</button>
          </li>
        ))}
        {rows.length === 0 && <li style={{ color: "var(--ink-muted)", padding: "10px 0" }}>No files yet.</li>}
      </ul>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <input type="file" multiple accept=".txt,.md,.text,.pdf" disabled={busy} onChange={onFilesChosen} />
        <span style={{ color: failed ? "var(--danger)" : "var(--ink-muted)", fontSize: 14 }}>{status}</span>
      </div>
    </section>
  );
}
