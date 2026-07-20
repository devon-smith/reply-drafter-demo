import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import KbManager from "./components/KbManager.jsx";
import PromptSettings from "./components/PromptSettings.jsx";
import WritingMaterial from "./components/WritingMaterial.jsx";
import Usage from "./components/Usage.jsx";
import { wrap, card, btn, btnGhost, muted, mono } from "./styles.js";

// The backend the drafts actually hit — shown in the breadcrumb + liveness pill.
const BACKEND = import.meta.env.VITE_BACKEND_URL || "https://reply-devon.duckdns.org";
const BACKEND_HOST = (() => {
  try { return new URL(BACKEND).host; } catch { return BACKEND.replace(/^https?:\/\//, ""); }
})();

// Tabs, in order. The numeric hotkey (1–4) maps to the index. `save` marks the
// sections whose primary action is a Save (drives the top-bar button).
const TABS = [
  { key: "usage", label: "Usage & cost", icon: "chart" },
  { key: "prompt", label: "Prompt & tone", icon: "star" },
  { key: "material", label: "Writing material", icon: "doc" },
  { key: "kb", label: "Knowledge base", icon: "db" },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("usage");
  const [q, setQ] = useState("");
  const [health, setHealth] = useState("checking"); // checking | live | down
  const searchRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Best-effort liveness ping. no-cors resolves when the endpoint is reachable
  // (opaque response) and rejects on a network failure — enough for a dot.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    fetch(BACKEND + "/health", { mode: "no-cors" })
      .then(() => alive && setHealth("live"))
      .catch(() => alive && setHealth("down"));
    return () => { alive = false; };
  }, [session]);

  // Keyboard: 1–4 switch sections; ⌘K focuses search; ⌘S broadcasts a save the
  // active panel can honor (PromptSettings listens). Digits are ignored while typing.
  useEffect(() => {
    if (!session) return;
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        searchRef.current && searchRef.current.focus();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("dashboard:save"));
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < TABS.length) { e.preventDefault(); setTab(TABS[i].key); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  if (loading) return <Center>Loading…</Center>;
  if (!session) return <SignIn />;

  const active = TABS.find((t) => t.key === tab) || TABS[0];
  const filtered = q.trim()
    ? TABS.filter((t) => t.label.toLowerCase().includes(q.trim().toLowerCase()))
    : TABS;

  return (
    <div style={{ ...wrap, display: "flex", minHeight: "100vh" }}>
      {/* ---- sidebar ---- */}
      <aside style={S.sidebar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px 18px" }}>
          <Logo />
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>Reply Drafter</span>
        </div>

        <div style={S.search}>
          <SearchIcon />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && filtered[0]) { setTab(filtered[0].key); setQ(""); } }}
            placeholder="Search"
            style={S.searchInput}
          />
          <span style={{ ...mono, fontSize: 11, color: "var(--ink-muted)" }}>⌘K</span>
        </div>

        <div className="kicker" style={{ padding: "18px 8px 8px" }}>Settings</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map((t) => {
            const on = t.key === tab;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ ...S.nav, ...(on ? S.navOn : null) }}>
                <NavIcon name={t.icon} active={on} />
                <span style={{ flex: 1, textAlign: "left" }}>{t.label}</span>
                <span style={{ ...S.num, ...(on ? S.numOn : null) }}>{TABS.indexOf(t) + 1}</span>
              </button>
            );
          })}
          {filtered.length === 0 && <div style={{ ...muted, padding: "8px 10px" }}>No match.</div>}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px solid var(--hairline)" }}>
          <div style={{ ...mono, fontSize: 11, color: "var(--ink-muted)", padding: "2px 8px 8px", overflow: "hidden", textOverflow: "ellipsis" }}>
            {session.user.email}
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ ...btnGhost, width: "100%" }}>Sign out</button>
        </div>
      </aside>

      {/* ---- main ---- */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={S.topbar}>
          <div style={{ ...mono, fontSize: 13, color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span>{BACKEND_HOST}</span>
            <span style={{ margin: "0 8px", color: "var(--hairline-strong)" }}>/</span>
            <span style={{ color: "var(--ink-2)" }}>{active.label.toLowerCase()}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={S.pill} title={`${BACKEND}/health`}>
              <span style={{ ...S.dot, background: health === "live" ? "var(--ok)" : health === "down" ? "var(--danger)" : "var(--ink-muted)" }} />
              <span style={{ ...mono, fontSize: 12, color: "var(--ink-2)" }}>
                {health === "live" ? "Endpoint live" : health === "down" ? "Endpoint down" : "Checking…"}
              </span>
            </span>
            {active.save && (
              <button onClick={() => window.dispatchEvent(new CustomEvent("dashboard:save"))} style={btn}>
                Save changes
              </button>
            )}
          </div>
        </header>

        <main style={{ padding: "30px 34px 72px", maxWidth: 780, width: "100%" }}>
          {tab === "usage" && <Usage />}
          {tab === "prompt" && <PromptSettings email={session.user.email} />}
          {tab === "material" && <WritingMaterial email={session.user.email} />}
          {tab === "kb" && <KbManager email={session.user.email} />}
        </main>
      </div>
    </div>
  );
}

const S = {
  sidebar: {
    width: 260,
    flexShrink: 0,
    minHeight: "100vh",
    padding: 18,
    borderRight: "1px solid var(--hairline)",
    background: "var(--surface)",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
    alignSelf: "flex-start",
  },
  search: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    background: "var(--field-bg)",
    border: "1px solid var(--field-border)",
    borderRadius: "var(--radius-sm)",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    background: "transparent",
    border: 0,
    outline: "none",
    color: "var(--ink)",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 10px",
    background: "transparent",
    border: 0,
    borderRadius: "var(--radius-sm)",
    color: "var(--ink-2)",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    fontWeight: 500,
  },
  navOn: { background: "var(--accent-soft)", color: "var(--ink)" },
  num: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--ink-muted)",
    background: "var(--surface-3)",
    borderRadius: 5,
    padding: "1px 6px",
  },
  numOn: { color: "var(--accent)", background: "rgba(124,116,255,0.16)" },
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 34px",
    borderBottom: "1px solid var(--hairline)",
    background: "rgba(10,10,13,0.72)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "5px 10px",
    border: "1px solid var(--hairline-strong)",
    borderRadius: 999,
  },
  dot: { width: 7, height: 7, borderRadius: 999, display: "inline-block" },
};

// --- small inline icons (currentColor, 16px) ---
function NavIcon({ name, active }) {
  const c = active ? "var(--accent)" : "var(--ink-muted)";
  const p = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: c, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "chart") return (<svg {...p}><path d="M2 13.5h12" /><rect x="3" y="8" width="2.5" height="4" /><rect x="6.75" y="5" width="2.5" height="7" /><rect x="10.5" y="3" width="2.5" height="9" /></svg>);
  if (name === "star") return (<svg {...p} fill={active ? "var(--accent)" : "none"}><path d="M8 2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.8 4.4 13.9l.7-4L2.2 6.3l4-.6L8 2z" /></svg>);
  if (name === "doc") return (<svg {...p}><path d="M4 2h5l3 3v9H4V2z" /><path d="M9 2v3h3" /></svg>);
  return (<svg {...p}><ellipse cx="8" cy="4" rx="5" ry="2" /><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4" /><path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" /></svg>);
}
function SearchIcon() {
  return (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--ink-muted)" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="M11 11l3 3" strokeLinecap="round" /></svg>);
}
function Logo() {
  return (
    <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0 }}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#0a0a0d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 4L4 8l5 4" /><path d="M4 8h6a3 3 0 013 3v1" />
      </svg>
    </span>
  );
}

function SignIn() {
  // Return to the CURRENT origin (localhost:5173 in dev, the Vercel URL in prod).
  // This origin must also be in Supabase → Authentication → URL Configuration.
  const signIn = () =>
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/app` } });
  return (
    <Center>
      <div style={{ ...card, textAlign: "center", maxWidth: 400, padding: 36 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Logo /></div>
        <span className="kicker" style={{ color: "var(--accent)" }}>Reply Drafter</span>
        <h1 style={{ margin: "10px 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Sign in</h1>
        <p style={{ ...muted, marginTop: 0 }}>Manage your knowledge base and reply tone.</p>
        <button onClick={signIn} style={{ ...btn, padding: "11px 18px", marginTop: 16 }}>Continue with Google</button>
      </div>
    </Center>
  );
}

function Center({ children }) {
  return <div style={{ ...wrap, display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>{children}</div>;
}
