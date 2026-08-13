# FROST // WEEK TRACKER

A gamified weekly task tracker. True black canvas, one hero completion ring, today's
tasks front and centre, and the rest of the week collapsed underneath.

Works offline on one device out of the box. Add a free Firebase project and it becomes a
real account-backed app — sign in with Google and your weeks follow you everywhere.

---

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. That's it — no account needed, no config. Your data is saved
to this browser.

To sync across devices, follow **Sign in with Google** below.

---

## What it does

- **Today gets a card.** It's the only bordered, glowing element on the page, and its
  task list is open by default
- **The other six days are rows** — a ring, a date, a count — that expand on click
- **Click anywhere on a task row** to check it off; it strikes through and dims
- **Hover a row** for edit (✎) and delete (×). Emptying a task's text removes the row
- **A single `+ add task`** per day. New rows focus immediately, so you can just type
- **Completed / Left** counters, always derived from the checkboxes so they can't drift
- **Weekly Focus / Reward / Affirmation** panel with Save + Clear
- **Week selector** — arrows, a dropdown of every saved week, and a "today" jump.
  Navigate to any week, past or future; it's created the moment you edit it
- **Autosave** on a 300ms debounce. The Save button is only for the Focus/Reward/
  Affirmation fields
- **Clear** resets the week's checkmarks but keeps your task text. Click twice to confirm

---

## Sign in with Google (~5 minutes)

One website, no Google Cloud Console, no secrets, no SQL. The free tier is plenty, and
unlike some alternatives it does not pause your project when you don't use it for a week.

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** →
   name it → you can uncheck Google Analytics → **Create**
2. **Build → Authentication → Get started → Sign-in method → Google** → **Enable** →
   pick a **Project support email** → **Save**
3. **Authentication → Settings → Authorized domains → Add domain** → your domain, e.g.
   `planner.froststudio.org`. (`localhost` is already authorised)
4. **Build → Firestore Database → Create database** → nearest region → **Production
   mode** → Create
5. **Firestore → Rules** → paste [`firestore.rules`](firestore.rules) from this repo →
   **Publish**
6. ⚙ **Project settings → Your apps → `</>` (Web)** → nickname → **Register app** → copy
   the `firebaseConfig` object it shows you
7. Paste those six values into [`src/lib/firebase-config.ts`](src/lib/firebase-config.ts),
   then commit and push

Step 2 is the part that matters: **Firebase creates the Google OAuth client for you**, so
you never open the Google Cloud Console, never copy a client secret, and never register a
redirect URI.

Now click **sign in** in the header → **continue with google**. Anything you'd already
built up offline is moved into your account automatically the first time you sign in.

> **Are those six values safe to commit?** Yes. They're public client identifiers, not
> secrets — they identify the project, they don't grant access to it. Anyone can read them
> out of any deployed Firebase app's bundle. Access is controlled entirely by
> [`firestore.rules`](firestore.rules), which scopes every document to `request.auth.uid`.

Sign-in uses a popup rather than a redirect, so the OAuth handshake happens on Firebase's
own domain and a static host never has to serve a callback path.

---

## Deploying

The repo ships with a GitHub Actions workflow that builds and publishes to GitHub Pages on
every push to `main`.

1. Push the repo to GitHub
2. On GitHub: **Settings → Pages → Source: GitHub Actions**
3. Push. The Actions tab shows the build

No repository secrets are needed — the Firebase config is committed. If you'd rather point
a build at a separate project, the `VITE_FIREBASE_*` variables in `.env.example` override
the committed values.

Any static host works — `npm run build` outputs `dist/`.

---

## Project layout

```
src/
├── types.ts               Task / Day / Week
├── lib/
│   ├── week.ts            Date math, week construction, ALL derived stats
│   ├── storage.ts         WeekStore interface + local and cloud implementations
│   ├── firebase.ts        App / auth / Firestore Lite handles
│   └── firebase-config.ts The six values you paste in — the only setup step
├── hooks/
│   ├── useAuth.ts         Session state, Google sign in/out
│   └── useWeek.ts         The current Week + every mutation + debounced autosave
└── components/
    ├── AmbientBackground  Fixed black canvas, cyan wash, 80 drifting motes
    ├── HeroPanel          The signature element — owns the only looping glow
    ├── TodayCard          The one bordered/glowing card, task list open
    ├── DayRow             Non-today days: borderless, collapsed, expand on click
    ├── ProgressRing       variant: 'hero' | 'quiet'
    ├── TaskRow            Checkbox + inline-editable label
    ├── ControlPanel       Focus/Reward/Affirmation + Save/Clear
    ├── Header             Wordmark, week nav, profile
    ├── AccountDialog      Google sign-in + profile card (also exports Avatar)
    └── GoogleMark         The official "G", used in our own button
```

Local and cloud storage both implement the same `WeekStore` interface, so no component
knows or cares which one is active. Cloud documents live at
`users/{uid}/weeks/{weekStart}`.

## Scripts

```bash
npm run dev        # dev server
npm run build      # type-check + production build to dist/
npm run typecheck  # types only
npm run preview    # serve the built output
```

## Stack

Vite 8 · React 19 · TypeScript 7 · Tailwind CSS 4 · Firebase Auth + Firestore Lite

Hand-rolled SVG for the rings and CSS keyframes for the glow — no chart or animation
library.
