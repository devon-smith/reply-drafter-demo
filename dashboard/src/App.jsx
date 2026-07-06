import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import KbManager from "./components/KbManager.jsx";
import PromptSettings from "./components/PromptSettings.jsx";
import WritingMaterial from "./components/WritingMaterial.jsx";
import Usage from "./components/Usage.jsx";
import { wrap, card, btn, btnGhost, muted } from "./styles.js";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <Center>Loading…</Center>;
  if (!session) return <SignIn />;

  return (
    <div style={wrap}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "6px 4px 16px", borderBottom: "1px solid rgba(28,35,51,0.08)" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 680, letterSpacing: "-0.02em" }}>Reply Drafter</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={muted}>{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} style={btnGhost}>Sign out</button>
        </div>
      </header>
      <p style={{ ...muted, marginTop: 14 }}>These settings drive your Claude reply drafts in Gmail. You see only your own data.</p>
      <Usage />
      <PromptSettings email={session.user.email} />
      <WritingMaterial email={session.user.email} />
      <KbManager email={session.user.email} />
    </div>
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
      <div style={{ ...card, textAlign: "center", maxWidth: 380, padding: 32, marginTop: 0 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 680, letterSpacing: "-0.02em" }}>Reply Drafter</h1>
        <p style={{ ...muted, marginTop: 0 }}>Sign in to manage your knowledge base and reply tone.</p>
        <button onClick={signIn} style={{ ...btn, padding: "11px 18px", marginTop: 14 }}>Sign in with Google</button>
      </div>
    </Center>
  );
}

function Center({ children }) {
  return <div style={{ ...wrap, display: "grid", placeItems: "center", minHeight: "80vh" }}>{children}</div>;
}
