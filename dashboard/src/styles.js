// Shared inline styles, routed through the theme.css design tokens. Updating
// these propagates the dark editorial treatment to every component that uses them.

// Full-bleed shell; the readable content column is capped separately (see `column`).
export const wrap = {
  minHeight: "100vh",
  fontFamily: "var(--font-sans)",
  color: "var(--ink)",
};
// Cap the settings column so long lines stay readable on wide screens.
export const column = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "0 24px 72px",
};
export const card = {
  background: "var(--surface)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--radius)",
  padding: 22,
};
// Uppercase mono kicker — the editorial section label.
export const kicker = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--ink-muted)",
  display: "block",
  marginBottom: 10,
};
export const h2 = {
  margin: "0 0 6px",
  fontSize: 19,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
};
export const label = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--ink-2)",
  marginTop: 16,
  marginBottom: 6,
};
export const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  background: "var(--field-bg)",
  border: "1px solid var(--field-border)",
  borderRadius: "var(--radius-sm)",
  marginTop: 0,
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  color: "var(--ink)",
};
export const btn = {
  padding: "9px 16px",
  background: "var(--accent)",
  color: "#0a0a0d",
  border: 0,
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 14,
};
export const btnGhost = {
  padding: "6px 12px",
  background: "transparent",
  color: "var(--ink-2)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
};
export const muted = { color: "var(--ink-muted)", fontSize: 14 };
// Tabular figures for metrics / paths / endpoints.
export const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };
