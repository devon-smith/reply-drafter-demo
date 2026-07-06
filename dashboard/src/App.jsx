import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import KbManager from "./components/KbManager.jsx";
import PromptSettings from "./components/PromptSettings.jsx";
import WritingMaterial from "./components/WritingMaterial.jsx";
import Usage from "./components/Usage.jsx";
import { wrap, column, card, btn, btnGhost, muted, mono } from "./styles.js";

// Tabs, in order. The numeric hotkey (1–4) maps to the index.
const TABS = [
  { key: "usage", label: "Usage" },
  { key: "prompt", label: "Prompt & tone" },
  { key: "material", label: "Writing material" },
  { key: "kb", label: "Knowledge base" },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("usage");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Keyboard nav: 1–4 switch tabs; ⌘S / Ctrl-S broadcasts a save request that the
  // active panel can honor (PromptSettings listens). Ignore digit keys while typing.
  useEffect(() => {
    if (!session) return;
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("dashboard:save"));
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < TABS.length) {
        e.preventDefault();
        setTab(TABS[i].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  if (loading) return <Center>Loading…</Center>;
  if (!session) return <SignIn />;

  return (
    <div style={wrap}>
      <header
        style={{
          borderBottom: "1px solid var(--hairline)",
          background: "rgba(10,10,13,0.72)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            ...column,
            padding: "18px 24px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div>
            <span className="kicker" style={{ color: "var(--accent)" }}>Reply Drafter</span>
            <h1 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Settings
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
            <span style={{ ...mono, fontSize: 12, color: "var(--ink-muted)" }}>{session.user.email}</span>
            <button onClick={() => supabase.auth.signOut()} style={btnGhost}>Sign out</button>
          </div>
        </div>
        <nav style={{ ...column, padding: "16px 24px 0", display: "flex", gap: 4 }}>
          {TABS.map((t, i) => (
            <Tab key={t.key} n={i + 1} active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </Tab>
          ))}
        </nav>
      </header>

      <main style={{ ...column, paddingTop: 26 }}>
        <p style={{ ...muted, marginTop: 0, marginBottom: 22 }}>
          These settings drive your Claude reply drafts in Gmail. You see only your own data.
          <span style={{ ...mono, fontSize: 12, color: "var(--ink-muted)", marginLeft: 10 }}>
            press 1–4 to switch · ⌘S to save
          </span>
        </p>
        {tab === "usage" && <Usage />}
        {tab === "prompt" && <PromptSettings email={session.user.email} />}
        {tab === "material" && <WritingMaterial email={session.user.email} />}
        {tab === "kb" && <KbManager email={session.user.email} />}
      </main>
    </div>
  );
}

function Tab({ n, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: "transparent",
        border: 0,
        borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
        color: active ? "var(--ink)" : "var(--ink-2)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        marginBottom: -1,
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: active ? "var(--accent)" : "var(--ink-muted)" }}>
        {n}
      </span>
      {children}
    </button>
  );
}

function SignIn() {
  // Return to the CURRENT origin (localhost:5173 in dev, the Vercel URL in prod) —
  // never a hardcoded port. IMPORTANT: this origin must also be added in Supabase →
  // Authentication → URL Configuration (Site URL + Redirect URLs); otherwise Supabase
  // ignores redirectTo and falls back to its Site URL (which defaults to localhost port
  // 3000 — the cause of the "redirect to the wrong port" bug).
  const signIn = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
  return (
    <Center>
      <div style={{ ...card, textAlign: "center", maxWidth: 400, padding: 36 }}>
        <span className="kicker" style={{ color: "var(--accent)" }}>Reply Drafter</span>
        <h1 style={{ margin: "10px 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Sign in
        </h1>
        <p style={{ ...muted, marginTop: 0 }}>Manage your knowledge base and reply tone.</p>
        <button onClick={signIn} style={{ ...btn, padding: "11px 18px", marginTop: 16 }}>
          Continue with Google
        </button>
      </div>
    </Center>
  );
}

function Center({ children }) {
  return (
    <div style={{ ...wrap, display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
      {children}
    </div>
  );
}
