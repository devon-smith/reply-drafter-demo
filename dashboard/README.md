# Reply Drafter — Settings dashboard

A small React + Vite SPA where each family member signs in with Google and manages their own
**knowledge base** and **prompt/tone**, stored in Supabase. All data access goes through
`@supabase/supabase-js` with the **anon/publishable** key under Row-Level Security — there is no
custom backend for CRUD, and no secret in the browser. The `/draft` backend reads these rows
(service key, server-side) to personalize each user's drafts.

## Run locally

```bash
cd dashboard
npm install
cp .env.example .env.local     # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev                     # http://localhost:5173
```

- `VITE_SUPABASE_URL` = `https://vpzzizeputfephcdbdpa.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = the project's **publishable** key (`sb_publishable_…`) or legacy
  anon key — both are browser-safe (RLS protects the data). Never put the **service_role** key
  here.

## Google sign-in setup (yours to click through, once)

Supabase Auth needs the Google provider enabled and a Google OAuth client:

1. **Google Cloud Console** → APIs & Services → Credentials → *Create OAuth client ID* (Web
   application). Authorized redirect URI:
   `https://vpzzizeputfephcdbdpa.supabase.co/auth/v1/callback`
2. **Supabase** → Authentication → Providers → **Google** → paste the client ID + secret, save.
3. **Supabase** → Authentication → **URL Configuration** — this is what fixes the
   "redirects to the wrong port after sign-in" bug. The app sends
   `redirectTo: window.location.origin`, but Supabase only honors it when the origin is
   allowlisted here; otherwise it falls back to **Site URL** (default `http://localhost:3000`).
   Set both:
   - **Site URL:** `https://reply-drafter-demo.vercel.app`
   - **Redirect URLs:** add `https://reply-drafter-demo.vercel.app/**` (prod) **and**
     `http://localhost:5173/**` (local dev).

On first sign-in, a trigger creates the user's `app_user` row automatically, so their KB and
prompt rows can be saved.

## Deploy

Static SPA — `npm run build` produces `dist/`. Host on Vercel/Netlify (free) or serve `dist/`
from Caddy on the VPS. Add the deployed origin to Supabase Auth *Redirect URLs* (step 3 above).

## How it maps to the schema

- **Prompt & tone** → one `prompt_setting` row per user (`system_prompt_append`, `tone`).
- **Knowledge base** → many `kb_entry` rows (`title`, `content`).
- RLS policy: a user may read/write only rows where `user_email = auth.jwt() ->> 'email'`.
