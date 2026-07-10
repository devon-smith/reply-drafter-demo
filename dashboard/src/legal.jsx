// Public legal/support pages served at /privacy, /terms, /support. These render
// OUTSIDE the auth gate (see main.jsx) so they load for anyone, and they must
// resolve on direct navigation + hard refresh (vercel.json rewrites all paths to
// index.html; main.jsx then picks the page from window.location.pathname).
//
// Content is ported from the VPS static pages (privacy.html / terms.html /
// support.html) with the Google-review compliance edits: "Gmail" -> "Gmail™"
// and the trademark footnote on each page.

const UPDATED = "July 7, 2026";
const CONTACT = "devonthomassmith@gmail.com";

const S = {
  page: { minHeight: "100vh", color: "var(--ink)", fontFamily: "var(--font-sans)" },
  bar: {
    borderBottom: "1px solid var(--hairline)", padding: "16px 24px",
    display: "flex", alignItems: "center", gap: 10,
  },
  brand: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--ink)" },
  logo: {
    width: 26, height: 26, borderRadius: 7, background: "var(--accent)",
    display: "grid", placeItems: "center", flexShrink: 0,
  },
  main: { maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px", lineHeight: 1.65 },
  h1: { fontSize: 30, letterSpacing: "-0.02em", margin: "0 0 4px", fontWeight: 700 },
  updated: { color: "var(--ink-muted)", fontSize: 14, margin: "0 0 10px" },
  lead: { fontSize: 17, color: "var(--ink-2)" },
  h2: { fontSize: 19, margin: "32px 0 8px", letterSpacing: "-0.01em", fontWeight: 600 },
  p: { color: "var(--ink-2)" },
  li: { color: "var(--ink-2)", margin: "6px 0" },
  a: { color: "var(--accent)" },
  code: { background: "var(--surface-2)", padding: "1px 6px", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: "0.9em" },
  callout: { background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 10, padding: "16px 18px", margin: "20px 0", color: "var(--ink-2)" },
  hr: { border: 0, borderTop: "1px solid var(--hairline)", margin: "36px 0" },
  foot: { color: "var(--ink-muted)", fontSize: 14, marginTop: 40 },
  note: { color: "var(--ink-muted)", fontSize: 13, marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--hairline)" },
};

function Trademark() {
  return (
    <p style={S.note}>
      Gmail™ is a trademark of Google LLC. Reply Drafter is not created by, affiliated with, or
      endorsed by Google LLC.
    </p>
  );
}

function Shell({ title, children }) {
  return (
    <div style={S.page}>
      <header style={S.bar}>
        <a href="/" style={S.brand}>
          <span style={S.logo}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#0a0a0d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4L4 8l5 4" /><path d="M4 8h6a3 3 0 013 3v1" />
            </svg>
          </span>
          <span style={{ fontWeight: 700, letterSpacing: "-0.01em" }}>Reply Drafter</span>
        </a>
      </header>
      <main style={S.main}>
        <h1 style={S.h1}>{title}</h1>
        {children}
      </main>
    </div>
  );
}

function Privacy() {
  return (
    <Shell title="Privacy Policy">
      <p style={S.updated}>Last updated: {UPDATED}</p>
      <p style={S.lead}>
        Reply Drafter is a small, self-hosted tool that drafts email replies using Anthropic's Claude.
        It is run privately for a handful of family members and friends — not a commercial product.
        This page explains, plainly, what it touches and where that goes.
      </p>

      <h2 style={S.h2}>What Reply Drafter accesses</h2>
      <ul>
        <li style={S.li}><strong>The email you choose to reply to.</strong> Only when you click
          <em> Generate reply</em> on an open message, it reads that message and its quoted thread
          history so the draft is relevant. It does <strong>not</strong> scan your inbox in bulk — the
          Gmail™ add-on can only see the single message you have open.</li>
        <li style={S.li}><strong>Your email address.</strong> Taken from your Google sign-in, used to
          load <em>your</em> saved settings (tone, knowledge base, writing samples).</li>
        <li style={S.li}>Nothing else in your Google account.</li>
      </ul>

      <h2 style={S.h2}>Where your data flows</h2>
      <ul>
        <li style={S.li}>When you click <em>Generate reply</em>, the message content and your settings
          are sent to a private, self-hosted backend at <code style={S.code}>reply-devon.duckdns.org</code>
          (a single server operated by the developer), over HTTPS.</li>
        <li style={S.li}>That backend calls <strong>Anthropic's Claude API</strong> to generate the
          reply. Per Anthropic's commercial terms, API inputs and outputs are automatically deleted
          within <strong>30 days</strong>, are <strong>not used to train models</strong> without express
          permission, and may be retained up to 2 years only if a request is flagged for a policy
          violation. See <a style={S.a} href="https://platform.claude.com/docs/en/manage-claude/api-and-data-retention">Anthropic's
          data-retention policy</a>.</li>
        <li style={S.li}>The generated text is placed into a Gmail™ <strong>draft you can edit</strong>.
          Nothing is ever sent on your behalf — you review and send every reply yourself.</li>
      </ul>

      <h2 style={S.h2}>What is stored, and where</h2>
      <ul>
        <li style={S.li}>Your <strong>tone/prompt settings, knowledge-base entries, and uploaded writing
          files</strong> are stored in <strong>Supabase</strong> (managed Postgres + file Storage) so
          your drafts sound like you.</li>
        <li style={S.li}>Each user's data is isolated by <strong>row-level security</strong>: you can only
          ever read or change your own rows, and no other user — or the public — can see them.</li>
        <li style={S.li}>We also keep a small <strong>usage record</strong> per request (token counts,
          estimated cost, your email, timestamp) purely for cost control.</li>
        <li style={S.li}>We do <strong>not</strong> store the content of the emails you draft replies
          for. That content passes through to generate the reply and is not saved in our database.</li>
      </ul>

      <h2 style={S.h2}>What we do not do</h2>
      <ul>
        <li style={S.li}>We do not sell or rent your data.</li>
        <li style={S.li}>We do not use it for advertising.</li>
        <li style={S.li}>We do not share one user's data with any other user.</li>
        <li style={S.li}>We do not use your data to train any AI model.</li>
      </ul>

      <h2 style={S.h2}>Permissions we request, and why</h2>
      <ul>
        <li style={S.li}><code style={S.code}>gmail.addons.execute</code> — lets the add-on run inside
          Gmail™ and show its panel.</li>
        <li style={S.li}><code style={S.code}>gmail.addons.current.message.readonly</code> — reads the
          single email you currently have open, so the draft replies to the right message and thread.</li>
        <li style={S.li}><code style={S.code}>gmail.addons.current.action.compose</code> — opens a
          pre-filled draft reply for you to edit; it cannot send mail.</li>
        <li style={S.li}><code style={S.code}>script.external_request</code> — lets the add-on send the
          message to our backend (and on to Claude) to generate the reply.</li>
        <li style={S.li}><code style={S.code}>userinfo.email</code> — reads only your email address, to
          load your personal settings.</li>
      </ul>

      <h2 style={S.h2}>Deleting your data</h2>
      <ul>
        <li style={S.li}>In the dashboard you can delete any knowledge-base entry, remove any uploaded
          writing file, and clear your tone/settings at any time. Deletes take effect immediately and
          remove the data from Supabase.</li>
        <li style={S.li}>To remove your account and all associated data entirely, email the contact below
          and it will be deleted.</li>
      </ul>

      <h2 style={S.h2}>Security</h2>
      <p style={S.p}>Traffic is encrypted in transit (HTTPS/TLS). API keys and the database service key
      live only on the server, never in the add-on, the dashboard, or any client. Access to your stored
      settings is enforced by row-level security.</p>

      <hr style={S.hr} />
      <footer style={S.foot}>
        <p><strong>Contact:</strong> <a style={S.a} href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
        <p>See also our <a style={S.a} href="/terms">Terms of Service</a> and
          {" "}<a style={S.a} href="/support">Support</a> pages.</p>
      </footer>
      <Trademark />
    </Shell>
  );
}

function Terms() {
  return (
    <Shell title="Terms of Service">
      <p style={S.updated}>Last updated: {UPDATED}</p>
      <p style={S.lead}>
        Reply Drafter is a small, self-hosted tool that drafts email replies using Anthropic's Claude,
        provided free to a small private group of family and friends. By using it, you agree to these
        terms.
      </p>

      <h2 style={S.h2}>1. What the service is</h2>
      <p style={S.p}>Reply Drafter is a personal, non-commercial project. It is offered
      <strong> as is</strong>, with no guarantee of availability, accuracy, or fitness for any particular
      purpose. It is not affiliated with Google or Anthropic.</p>

      <h2 style={S.h2}>2. Acceptable use</h2>
      <ul>
        <li style={S.li}>Use it only to help draft your own email replies.</li>
        <li style={S.li}>Do not use it to generate spam, harassment, unlawful content, or anything that
          violates Gmail™'s or Anthropic's usage policies.</li>
        <li style={S.li}>Do not attempt to access other users' data or the underlying infrastructure.</li>
      </ul>

      <h2 style={S.h2}>3. AI-generated content</h2>
      <p style={S.p}>Replies are generated by an AI model and may be inaccurate, incomplete, or
      inappropriate. Every reply is created as an <strong>editable draft</strong> — nothing is ever sent
      automatically. You are responsible for reviewing, editing, and deciding whether to send any draft.</p>

      <h2 style={S.h2}>4. Availability</h2>
      <p style={S.p}>The service runs on a single private server and may be unavailable, slow, or
      discontinued at any time without notice. There is no service-level guarantee.</p>

      <h2 style={S.h2}>5. Your data</h2>
      <p style={S.p}>How your data is handled is described in our
      {" "}<a style={S.a} href="/privacy">Privacy Policy</a>. You can delete your stored settings from the
      dashboard at any time, or contact us to remove your account entirely.</p>

      <h2 style={S.h2}>6. Limitation of liability</h2>
      <p style={S.p}>To the fullest extent permitted by law, the developer is not liable for any damages
      arising from your use of Reply Drafter, including anything resulting from an AI-generated draft or
      from any interruption or loss of service. The service is provided without warranties of any kind.</p>

      <h2 style={S.h2}>7. Changes</h2>
      <p style={S.p}>These terms may be updated from time to time. Continued use after a change means you
      accept the updated terms. The "last updated" date above reflects the current version.</p>

      <hr style={S.hr} />
      <footer style={S.foot}>
        <p><strong>Contact:</strong> <a style={S.a} href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
        <p>See also our <a style={S.a} href="/privacy">Privacy Policy</a> and
          {" "}<a style={S.a} href="/support">Support</a> pages.</p>
      </footer>
      <Trademark />
    </Shell>
  );
}

function Support() {
  return (
    <Shell title="Support">
      <p style={S.lead}>
        Reply Drafter is a small tool that drafts email replies in your own voice using Anthropic's
        Claude — you open an email, click Generate, and edit the draft before sending.
      </p>

      <div style={S.callout}>
        <strong>Need help?</strong> Email <a style={S.a} href={`mailto:${CONTACT}`}>{CONTACT}</a> and
        we'll get back to you.
      </div>

      <h2 style={S.h2}>Getting started</h2>
      <ul>
        <li style={S.li}><strong>Install:</strong> open the install link you were sent, choose
          <em> Install</em>, and grant the requested permissions. Refresh Gmail™ afterward.</li>
        <li style={S.li}><strong>Draft a reply:</strong> open any email, click the
          <strong> Reply Drafter</strong> icon in the right-side panel, then <strong>Generate reply</strong>.
          A draft opens in a compose window.</li>
        <li style={S.li}><strong>Set your voice:</strong> sign into this dashboard with the same Google
          account and set your <em>tone</em>, add <em>knowledge-base</em> facts (name, sign-off,
          context), and upload <em>writing samples</em> so drafts sound like you.</li>
      </ul>

      <h2 style={S.h2}>Good to know</h2>
      <ul>
        <li style={S.li}>Every reply is an <strong>editable draft</strong> — nothing is ever sent
          automatically. You review and send each reply yourself.</li>
        <li style={S.li}>Use the <strong>same Google account</strong> in Gmail™ and the dashboard, or your
          saved settings won't load.</li>
        <li style={S.li}>The one-time <strong>"this app isn't verified"</strong> screen is expected for a
          private tool — choose <em>Advanced → continue</em> to proceed.</li>
      </ul>

      <h2 style={S.h2}>Common issues</h2>
      <ul>
        <li style={S.li}><strong>The panel is blank or missing</strong> — refresh the Gmail™ tab and
          reopen the message.</li>
        <li style={S.li}><strong>Drafts sound generic</strong> — make sure you signed into the dashboard
          with the same account and saved a tone / writing samples.</li>
        <li style={S.li}><strong>An error in the draft box</strong> — try again in a moment; if it
          persists, email us at the address above.</li>
      </ul>

      <hr style={S.hr} />
      <footer style={S.foot}>
        <p><strong>Contact:</strong> <a style={S.a} href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
        <p>See our <a style={S.a} href="/privacy">Privacy Policy</a> and
          {" "}<a style={S.a} href="/terms">Terms of Service</a>.</p>
      </footer>
      <Trademark />
    </Shell>
  );
}

const PAGES = { privacy: Privacy, terms: Terms, support: Support };

export default function Legal({ page }) {
  const Comp = PAGES[page] || Privacy;
  return <Comp />;
}
