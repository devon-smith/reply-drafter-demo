// Shared inline styles, routed through the theme.css design tokens. Updating
// these propagates the glass treatment to every component that uses them.
export const wrap = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "28px 24px 64px",
  fontFamily: "inherit",
  color: "var(--ink)",
};
export const card = {
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--blur)) saturate(1.4)",
  WebkitBackdropFilter: "blur(var(--blur)) saturate(1.4)",
  border: "1px solid var(--glass-border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--glass-shadow)",
  padding: 20,
  marginTop: 18,
};
export const h2 = {
  margin: "0 0 10px",
  fontSize: 16,
  fontWeight: 650,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
};
export const label = { display: "block", fontSize: 13, color: "var(--ink-2)", marginTop: 10, marginBottom: 2 };
export const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  background: "var(--field-bg)",
  border: "1px solid var(--field-border)",
  borderRadius: "var(--radius-sm)",
  marginTop: 4,
  fontFamily: "inherit",
  fontSize: 14,
  color: "var(--ink)",
};
export const btn = {
  padding: "9px 16px",
  background: "linear-gradient(180deg, var(--accent), var(--accent-strong))",
  color: "#fff",
  border: 0,
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
  boxShadow: "0 2px 10px var(--accent-ring)",
};
export const btnGhost = {
  padding: "6px 12px",
  background: "var(--glass-bg-strong)",
  color: "var(--ink-2)",
  border: "1px solid var(--field-border)",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  fontSize: 13,
};
export const muted = { color: "var(--ink-muted)", fontSize: 14 };
