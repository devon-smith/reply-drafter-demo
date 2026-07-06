import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { card, h2, muted } from "../styles.js";

// Personal usage/cost view. Reads the signed-in user's usage_event rows under
// RLS (anon key + Auth) — never the service key. Days are bucketed in UTC to
// match the backend's UTC daily cap.
const DAILY_TOKEN_CAP =
  Number(import.meta.env.VITE_DAILY_TOKEN_CAP) > 0
    ? Number(import.meta.env.VITE_DAILY_TOKEN_CAP)
    : 500000;

const DAY_MS = 24 * 60 * 60 * 1000;
const utcDayKey = (d) => new Date(d).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
const fmtInt = (n) => Math.round(n).toLocaleString();
const fmtCost = (n) => "$" + (n || 0).toFixed(4);

export default function Usage() {
  const [rows, setRows] = useState(null); // null = loading
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch enough history to cover both "this month" and the 30-day chart.
    const since = new Date(Math.min(Date.now() - 31 * DAY_MS, monthStartMs()));
    supabase
      .from("usage_event")
      .select("ts,input_tokens,output_tokens,est_cost_usd")
      .gte("ts", since.toISOString())
      .order("ts", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setRows(data || []);
      });
  }, []);

  if (rows === null) {
    return (
      <section style={card}>
        <h2 style={h2}>Usage &amp; cost</h2>
        <p style={muted}>Loading…</p>
      </section>
    );
  }

  const now = Date.now();
  const todayKey = utcDayKey(now);
  const monthKey = todayKey.slice(0, 7); // YYYY-MM (UTC)

  const agg = (pred) =>
    rows.filter(pred).reduce(
      (a, r) => ({
        requests: a.requests + 1,
        tokens: a.tokens + (r.input_tokens || 0) + (r.output_tokens || 0),
        cost: a.cost + Number(r.est_cost_usd || 0),
      }),
      { requests: 0, tokens: 0, cost: 0 }
    );

  const today = agg((r) => utcDayKey(r.ts) === todayKey);
  const month = agg((r) => utcDayKey(r.ts).slice(0, 7) === monthKey);

  // Last 30 UTC days, oldest→newest, tokens per day.
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const key = utcDayKey(now - i * DAY_MS);
    days.push({ key, tokens: 0, requests: 0, cost: 0 });
  }
  const byKey = Object.fromEntries(days.map((d) => [d.key, d]));
  for (const r of rows) {
    const d = byKey[utcDayKey(r.ts)];
    if (d) {
      d.tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
      d.requests += 1;
      d.cost += Number(r.est_cost_usd || 0);
    }
  }
  const maxTokens = Math.max(1, ...days.map((d) => d.tokens));
  const capPct = Math.min(100, Math.round((today.tokens / DAILY_TOKEN_CAP) * 100));

  const empty = rows.length === 0;

  return (
    <section style={card}>
      <h2 style={h2}>Usage &amp; cost</h2>
      {error && <p style={{ color: "var(--danger)", fontSize: 14 }}>Couldn't load usage: {error}</p>}
      {empty ? (
        <p style={muted}>No usage yet — generate a reply and it'll show up here.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <TileGroup label="Today (UTC)" s={today} />
            <TileGroup label="This month" s={month} />
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ ...muted, marginBottom: 4 }}>
              Today: {fmtInt(today.tokens)} / {fmtInt(DAILY_TOKEN_CAP)} tokens ({capPct}% of daily cap)
            </div>
            <div style={{ height: 8, background: "var(--hairline)", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  width: capPct + "%",
                  height: "100%",
                  background: capPct >= 100 ? "var(--danger)" : "var(--accent)",
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ ...muted, marginBottom: 6 }}>Daily tokens — last 30 days</div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
                height: 80,
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              {days.map((d) => {
                const h = d.tokens > 0 ? Math.max(2, Math.round((d.tokens / maxTokens) * 78)) : 0;
                return (
                  <div
                    key={d.key}
                    title={`${d.key}: ${fmtInt(d.tokens)} tokens, ${d.requests} req, ${fmtCost(d.cost)}`}
                    style={{
                      flex: 1,
                      height: h,
                      background: "var(--accent)",
                      borderRadius: "3px 3px 0 0",
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", ...muted, marginTop: 4, fontSize: 12 }}>
              <span>{days[0].key}</span>
              <span>peak {fmtInt(maxTokens)} tok/day</span>
              <span>{days[days.length - 1].key}</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function TileGroup({ label, s }) {
  return (
    <div style={{ flex: "1 1 240px", background: "var(--glass-bg-strong)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-sm)", padding: 14 }}>
      <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 16 }}>
        <Stat n={fmtInt(s.requests)} label="requests" />
        <Stat n={fmtInt(s.tokens)} label="tokens" />
        <Stat n={fmtCost(s.cost)} label="est. cost" />
      </div>
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>{n}</div>
      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</div>
    </div>
  );
}

function monthStartMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}
