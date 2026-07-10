import React from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import App from "./App.jsx";
import Legal from "./legal.jsx";
import Landing from "./Landing.jsx";

// Lightweight path routing (no router dependency). vercel.json rewrites every
// path to index.html, so these all work on direct navigation and hard refresh:
//   /                      -> public landing page (NO auth gate)
//   /app                   -> the authenticated settings dashboard (self-gated)
//   /privacy /terms /support -> public legal/support pages
const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
const LEGAL = { "/privacy": "privacy", "/terms": "terms", "/support": "support" };

let element;
if (LEGAL[path]) element = <Legal page={LEGAL[path]} />;
else if (path === "/app") element = <App />;
else element = <Landing />; // "" (root) and anything else -> public landing

createRoot(document.getElementById("root")).render(
  <React.StrictMode>{element}</React.StrictMode>
);
