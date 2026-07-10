import React from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import App from "./App.jsx";
import Legal from "./legal.jsx";

// Lightweight path routing (no router dependency). The legal/support pages are
// public and render OUTSIDE the auth-gated App. vercel.json rewrites every path
// to index.html, so these also work on direct navigation and hard refresh.
const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
const LEGAL = { "/privacy": "privacy", "/terms": "terms", "/support": "support" };
const legalPage = LEGAL[path];

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {legalPage ? <Legal page={legalPage} /> : <App />}
  </React.StrictMode>
);
