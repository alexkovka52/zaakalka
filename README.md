# ZAKALKA

ZAKALKA is a full-stack calisthenics and nutrition tracker built with Next.js App Router, Supabase Auth/Postgres/Storage, and server-side Gemini API routes. The original logo is in public/images/zakalka-logo.jpg.

## Requirements

- Node.js 20.9 or later (Node 24 is used in CI)
- pnpm 11
- A Supabase project
- A Google Gemini API key for AI Coach and food-photo estimates

## Local setup

1. Install packages:

   ~~~bash
   pnpm install
   ~~~

2. Create a Supabase project. In its SQL Editor, run [supabase/schema.sql](supabase/schema.sql). This creates the user profile trigger, workout, meal, daily goal, activity, dashboard settings and AI history tables; user data is protected with Row Level Security. The migration also creates a private food-photos bucket.

3. Copy .env.example to .env.local and set:

   ~~~env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   ~~~

   The Gemini key is read only by server routes. Never prefix it with NEXT_PUBLIC_ or commit .env.local.

4. In Supabase Authentication → URL Configuration, set the local site URL to http://localhost:3000 and allow http://localhost:3000/auth/callback as a redirect URL. Configure email confirmation according to how you want sign-up to work.

5. Start the app:

   ~~~bash
   pnpm dev
   ~~~

   Open http://localhost:3000.

## Deploy

GitHub Pages only hosts static files and cannot run the authenticated Next.js API routes needed to keep the Gemini secret on the server. Deploy this app to Vercel instead:

1. Push this project to a GitHub repository.
2. Import that repository in Vercel as a Next.js project.
3. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and GEMINI_API_KEY in Vercel Project Settings → Environment Variables for Production and Preview.
4. Set the Supabase Auth site URL and redirect URLs to the Vercel domain.
5. Redeploy after setting environment variables.

The GitHub Actions workflow runs TypeScript validation and a production build; Vercel handles deployment. If a Gemini key has ever been pasted into a chat, rotate it and use a fresh server-side secret.

## Included behavior

- Supabase email sign-up, sign-in, password reset, session persistence, and protected application state.
- Eight-step onboarding and editable profile.
- RU, EN, and RO localization with saved preference.
- Workout sessions with a live timer, exercise sets, finish, history details, and deletion.
- Meal macros/calories, private food-photo upload, Gemini estimate review/edit/confirm, and daily protein progress.
- Daily water tracking, goal XP, level progression, event history, and data-backed statistics.
- Reorderable/hideable dashboard blocks persisted in Supabase.
- Authenticated AI Coach with recent profile, workout, nutrition, and chat context.
- Responsive layout, keyboard-accessible controls, and reduced-motion support.

## Safety and data

- Only a Supabase publishable/anonymous key is used by the browser; RLS limits rows to the signed-in user.
- The Gemini secret stays in server environment variables.
- AI meal estimates are suggestions. Review and edit macros before saving.
- AI Coach does not provide medical diagnoses. Seek professional care for pain or concerning symptoms.
