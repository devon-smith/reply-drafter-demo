import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // The anon/publishable key is safe to ship to the browser — RLS protects data.
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — see .env.example");
}

export const supabase = createClient(url, anonKey);
