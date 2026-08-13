# FROST // WEEK TRACKER

A gamified weekly task tracker. Black background, glowing cyan accents, one column
per day, a progress ring per day, and a hero ring for the week.

Works offline on one device out of the box. Add a free Supabase project and it becomes
a real account-backed app — your weeks follow you to any device you sign in from.

---

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. That's it — no account needed, no config. Your data is
saved to this browser.

To sync across devices, follow **Cloud sync** below.

---

## What it does

- **7 day columns**, Monday–Sunday, each with a task checklist and a completion ring
- **Click anywhere on a row** to check a task off — it strikes through and dims
- **Hover a row** for edit (✎) and delete (×); blank rows are just text fields, type to fill
- **Completed / Left** counters per day, always derived from the checkboxes so they
  can't drift out of sync
- **Weekly Focus / Reward / Affirmation** panel with Save + Clear
- **Week selector** — arrows, a dropdown of every saved week, and a "Today" jump.
  Navigate to any week, past or future; it's created the moment you edit it
- **Autosave.** Task changes save automatically (300ms debounce). The Save button is
  only for the Focus/Reward/Affirmation fields
- **Clear** resets the week's checkmarks but keeps your task text. Click twice to confirm
- Responsive: 7-across on desktop, wraps on tablet, one swipeable day on mobile

Task checkmarks autosave. Blank placeholder rows aren't counted as tasks — a fresh day
reads 0/5, not 0/10.

---

## Cloud sync (~5 minutes)

Free tier is plenty for this.

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up
2. **New project** → name it anything → pick a region near you → set a database
   password (save it in your password manager; you won't need it for this app)
3. Wait ~2 minutes for it to provision

### 2. Create the table

1. In your project: **SQL Editor** → **New query**
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo, paste the whole
   thing in, click **Run**

This creates the `weeks` table and — importantly — the Row Level Security policies that
make each row readable only by the user who owns it.

### 3. Point the app at it

**Project Settings → API**, and copy two values:

| Value | Looks like |
| --- | --- |
| Project URL | `https://abcdefgh.supabase.co` |
| `anon` `public` key | `eyJhbGciOi…` (long) |

Then either:

**Option A — locally.** Copy `.env.example` to `.env`, paste both values in, restart
`npm run dev`.

**Option B — from inside the app.** Click **Sync across devices** in the header, paste
both values, hit Connect. Useful on a deployed build you don't want to rebuild.

### 4. Sign up

Click **Sync across devices** → **Sign up** → email + password. Anything you'd already
created offline is moved into your account automatically the first time you sign in.

Now sign in with the same account on your phone or any other machine and your weeks are
there.

> **Is the anon key safe to commit?** Yes. It's designed to ship in browser code. It
> grants nothing on its own — the RLS policies in `schema.sql` are what control access,
> and they restrict every row to `auth.uid()`. The key you must never commit is the
> `service_role` key. This app never uses it.

### Optional: skip email confirmation

By default Supabase emails a confirmation link before a new account can sign in. For a
personal app you may want it off: **Authentication → Sign In / Providers → Email** →
turn off **Confirm email**.

---

## Deploying

The repo ships with a GitHub Actions workflow that builds and publishes to GitHub Pages
on every push to `main`.

1. Push the repo to GitHub (see below)
2. On GitHub: **Settings → Pages → Source: GitHub Actions**
3. *(Optional)* **Settings → Secrets and variables → Actions → New repository secret**,
   add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` so cloud sync is baked into the
   deployed build. Skip this and you can still connect from inside the app.
4. Push. The Actions tab shows the build; your URL will be
   `https://<username>.github.io/<repo>/`

Any static host works too — `npm run build` outputs `dist/`. Vercel and Netlify both
deploy this with zero configuration.

---

## Project layout

```
src/
├── types.ts               Task / Day / Week
├── lib/
│   ├── week.ts            Date math, week construction, all derived stats
│   ├── storage.ts         WeekStore interface + local and cloud implementations
│   └── supabase.ts        Client setup; env config or in-app runtime config
├── hooks/
│   ├── useAuth.ts         Session state, sign in/up/out
│   └── useWeek.ts         The current Week + every mutation + debounced autosave
└── components/
    ├── ProgressRing.tsx   SVG donut with the glow/pulse/flash states
    ├── TaskRow.tsx        Checkbox + inline-editable label
    ├── DayColumn.tsx      Header + ring + tasks + Completed/Left footer
    ├── WeekOverview.tsx   7 daily bars + the hero week ring
    ├── ControlPanel.tsx   Focus / Reward / Affirmation + Save / Clear
    ├── Header.tsx         Wordmark, week selector, sync badge, account
    └── AccountDialog.tsx  Sign in / sign up / connect database
```

Local and cloud storage both implement the same `WeekStore` interface, so no component
knows or cares which one is active.

## Scripts

```bash
npm run dev        # dev server
npm run build      # type-check + production build to dist/
npm run typecheck  # types only
npm run preview    # serve the built output
```

## Stack

Vite 8 · React 19 · TypeScript 7 · Tailwind CSS 4 · Supabase

Hand-rolled SVG for the rings and CSS keyframes for the glow — no chart or animation
library.
