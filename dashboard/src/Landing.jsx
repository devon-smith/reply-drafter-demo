// Public marketing/landing page at "/" — NO auth gate, so Google's brand-
// verification crawler (and anyone) sees a description of the app instead of a
// login wall. The authenticated dashboard lives at /app. Styled with the dark
// theme tokens (theme.css).

const A = { color: "var(--accent)", textDecoration: "none" };
const container = { maxWidth: 920, margin: "0 auto", padding: "0 24px" };

function Logo({ size = 30 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 8, background: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0 }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 16 16" fill="none" stroke="#0a0a0d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 4L4 8l5 4" /><path d="M4 8h6a3 3 0 013 3v1" />
      </svg>
    </span>
  );
}

function Step({ n, title, body }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", marginBottom: 8 }}>{n}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

export default function Landing() {
  return (
    <div style={{ minHeight: "100vh", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
      {/* top bar */}
      <header style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ ...container, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo size={28} />
            <span style={{ fontWeight: 700, letterSpacing: "-0.01em", fontSize: 17 }}>Reply Drafter</span>
          </div>
          <a href="/app" style={{ padding: "9px 16px", background: "var(--accent)", color: "#0a0a0d", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            Sign in
          </a>
        </div>
      </header>

      {/* hero */}
      <section style={{ ...container, textAlign: "center", padding: "72px 24px 40px" }}>
        <span className="kicker" style={{ color: "var(--accent)" }}>Gmail™ add-on · powered by Claude</span>
        <h1 style={{ fontSize: 42, lineHeight: 1.1, letterSpacing: "-0.03em", fontWeight: 700, margin: "16px auto 0", maxWidth: 640 }}>
          Draft Gmail™ replies in your own voice
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: 18, lineHeight: 1.6, margin: "18px auto 0", maxWidth: 620 }}>
          Reply Drafter is a Gmail™ add-on that writes email replies for you using Anthropic's Claude.
          Open an email, click <strong style={{ color: "var(--ink)" }}>Generate</strong>, and get an
          editable draft you review and send yourself — nothing is sent automatically.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
          <a href="/app" style={{ padding: "12px 22px", background: "var(--accent)", color: "#0a0a0d", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
            Sign in with Google
          </a>
          <a href="/support" style={{ padding: "12px 22px", background: "transparent", color: "var(--ink-2)", border: "1px solid var(--hairline-strong)", borderRadius: "var(--radius-sm)", fontWeight: 500, fontSize: 15, textDecoration: "none" }}>
            How it works
          </a>
        </div>
        <p style={{ color: "var(--ink-muted)", fontSize: 13, marginTop: 20 }}>
          A small, private tool for personal and family use.
        </p>
      </section>

      {/* how it works */}
      <section style={{ ...container, paddingBottom: 64 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 8 }}>
          <Step n="01" title="Open an email" body="Open any message in Gmail™ and click the Reply Drafter panel." />
          <Step n="02" title="Generate a reply" body="Claude reads the message and drafts a reply in your tone, using facts and writing samples you set." />
          <Step n="03" title="Edit and send" body="The draft opens in a normal compose window. You review, tweak, and send it yourself." />
        </div>
      </section>

      {/* footer */}
      <footer style={{ borderTop: "1px solid var(--hairline)" }}>
        <div style={{ ...container, padding: "28px 24px", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <a href="/privacy" style={A}>Privacy</a>
            <a href="/terms" style={A}>Terms</a>
            <a href="/support" style={A}>Support</a>
            <a href="mailto:devonthomassmith@gmail.com" style={A}>Contact</a>
          </div>
          <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>© 2026 Reply Drafter</span>
        </div>
        <div style={{ ...container, padding: "0 24px 28px" }}>
          <p style={{ color: "var(--ink-muted)", fontSize: 12, margin: "0 0 8px", maxWidth: 760 }}>
            Reply Drafter's use of information received from Google APIs will adhere to the Google API
            Services User Data Policy, including the Limited Use requirements.
          </p>
          <p style={{ color: "var(--ink-muted)", fontSize: 12, margin: 0, maxWidth: 760 }}>
            Gmail™ is a trademark of Google LLC. Reply Drafter is not created by, affiliated with, or
            endorsed by Google LLC.
          </p>
        </div>
      </footer>
    </div>
  );
}
