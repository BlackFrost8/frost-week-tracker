# FROST // WEEK TRACKER — Handoff

Context for picking this project up in a new session. Written 13 Aug 2026.

---

## 1. Status at a glance

| | |
| --- | --- |
| Repo | https://github.com/BlackFrost8/frost-week-tracker (public) |
| Live URL | https://planner.froststudio.org |
| Local path | `C:\Users\josua\Downloads\LifeOrg` |
| Branch | `main` — **1 commit ahead of origin, not yet pushed** |
| Build | Passing (`npm run build`, type-check clean) |
| App works locally | Yes — verified in-browser |
| **Live site works** | **No — blocked on one GitHub setting, see §2** |
| Cloud sync | Code complete, **never configured or tested against a real project** |

Two commits of substance: `b0b3305` (build) and the redesign (rebased onto GitHub's
`d3f9f8d` CNAME commit). Nothing is half-finished in the code.

---

## 2. Do these first

### 2.1 Fix the blank live site — one setting, user action required

The site currently serves the **raw repo** instead of the built app. The browser is
handed `main.tsx`, gets MIME type `application/octet-stream`, refuses to execute it,
and renders nothing. Console shows:

> Failed to load module script: Expected a JavaScript-or-Wasm module script…

Cause: **Pages is set to "Deploy from a branch"**, which publishes files verbatim
rather than running the workflow that compiles them.

Fix: **Repo → Settings → Pages → Build and deployment → Source → "GitHub Actions"**

This is not a code bug. Do not "fix" it by changing `vite.config.ts` `base` — that is
already correct (`base: './'`, which works on both a project site and a custom domain).

### 2.2 Push

```bash
git push
```

Then watch the **Actions** tab. Green run = live for real.

> Note: `origin/main` had a `CNAME` commit created by GitHub when the custom domain was
> set in Settings. Local `main` has already been rebased onto it, so the push is clean.
> If the branches diverge again, `git pull --rebase origin main`.

There are now two CNAME files, both intentional:
- `/CNAME` (repo root) — written by GitHub, used by branch-deploy mode
- `/public/CNAME` — copied into `dist/` by Vite so the **Actions** artifact carries the
  domain. This is the one that matters going forward.

### 2.3 Set up Firebase (never done — cloud sync is untested)

Full walkthrough in [README.md](README.md#sign-in-with-google-5-minutes). Short version:
create a project → enable the Google sign-in provider → add your domain to Authorized
domains → create Firestore → publish [`firestore.rules`](firestore.rules) → paste the
six config values into [`src/lib/firebase-config.ts`](src/lib/firebase-config.ts).

**Supabase was removed** in favour of Firebase (see §5.8). The deciding factor was setup
burden on a static host: Supabase + Google OAuth is ~16 steps across the Supabase
dashboard *and* the Google Cloud Console, because you must create the OAuth client and
copy a client secret yourself. Firebase auto-provisions that OAuth client, so the whole
Cloud Console leg disappears — 7 steps, one website, no secrets, no SQL.

Until config is pasted in, the app runs local-only (localStorage, one device) and the
account dialog says so. **The cloud path — sign-in, Firestore read/write, rules,
migration — has only been verified as compiling and rendering, never against a live
project.** Treat first-run there as unproven.

---

## 3. What it is

A gamified weekly task tracker. 7 days, a checklist per day, completion rings, and a
Focus/Reward/Affirmation panel. Built from two spec files that live in the project root
(untracked, not committed):

- `frost-week-tracker-spec.md` — the original feature brief
- `frost-design-overhaul.md` — the design system rewrite (supersedes the first file's
  visual direction entirely)

**Where they conflict, the overhaul spec wins.** The original spec's §9 also declared
auth and cloud sync out of scope; the user explicitly overrode that, which is why the
storage layer exists.

---

## 4. Architecture

```
src/
├── types.ts               Task / Day / Week
├── lib/
│   ├── week.ts            Date math, week construction, ALL derived stats
│   ├── storage.ts         WeekStore interface + local and cloud implementations
│   ├── firebase.ts        App / auth / Firestore Lite handles; null when unconfigured
│   └── firebase-config.ts The six pasted values — the only setup step in the app
├── hooks/
│   ├── useAuth.ts         Session state + Profile, Google sign in/out
│   └── useWeek.ts         Current Week + every mutation + debounced autosave
└── components/
    ├── AmbientBackground  Fixed black canvas, cyan wash, 80 drifting motes
    ├── HeroPanel          The signature element — owns the only looping glow
    ├── TodayCard          The one bordered/glowing card, task list open
    ├── DayRow             Non-today days: borderless, collapsed, expand on click
    ├── ProgressRing       variant: 'hero' | 'quiet'
    ├── TaskRow            Checkbox + inline-editable label
    ├── ControlPanel       Focus/Reward/Affirmation + Save/Clear
    ├── Header             Wordmark, week nav, profile (avatar + first name)
    ├── AccountDialog      Google sign-in + profile card; also exports `Avatar`
    └── GoogleMark         The official "G", used inside our own button
```

`localStore` and `cloudStore` both implement `WeekStore`. **No component knows which is
active** — `App.tsx` picks one based on auth state and passes it to `useWeek`. Keep it
that way; it's what makes the offline→cloud upgrade seamless, and it's why swapping
Supabase for Firestore touched only `storage.ts` and left `useWeek` and every component
alone.

Cloud documents live at `users/{uid}/weeks/{weekStart}` — the week start is the document
id, so `listWeekStarts` is a pure id read needing no query or index.

---

## 5. Decisions that look wrong but aren't

Don't "fix" these without reading why.

1. **Days contain only real tasks, and `realTasks()` still filters by label.** Days used
   to ship padded to a fixed 10 rows, so a fresh day carried 5 real tasks and 5 blanks —
   and blanks render as live inputs with an "Add a task" placeholder, which is why every
   expanded day showed six separate ways to add a task. Both the seeder (`makeTasks`) and
   `normalizeWeek` have stopped padding, and `normalizeWeek` now also strips blanks on
   load so older saved weeks get swept clean. **Do not reintroduce padding.**
   `realTasks()` stays as a filter regardless: `addTask` still appends one transient
   blank row, which is the row you type into.
2. **Derived stats are never stored.** Completion %, Completed/Left are recomputed on
   every render so they cannot drift from the checkboxes. Don't cache them into `Week`.
3. **Dates are local-time, serialised `YYYY-MM-DD`.** `fromISODate` parses manually
   because `new Date("2026-08-10")` is treated as UTC and shifts the day in some
   timezones. Don't replace it with `new Date(iso)`.
4. **`base: './'` in vite.config.** Correct for both a Pages project site and the custom
   domain. Not the cause of the blank screen.
5. **The Firebase config is safe to commit.** Those six values are public client
   identifiers — they name the project, they don't grant access to it. Every deployed
   Firebase app ships them in its bundle. Access is controlled entirely by
   [`firestore.rules`](firestore.rules), scoping each document to `request.auth.uid`.
6. **Pending saves flush before a week switch.** `useWeek` keys each debounced write to
   its originating week, so a toggle made milliseconds before navigating still lands on
   the old week. This was explicitly tested. Don't simplify the debounce away.
7. **Weeks are created in memory and only persisted on first edit.** Navigating through
   empty weeks doesn't litter the database.
8. **Firestore over Postgres was a setup-burden decision, not a data-model one.** If
   multi-week analytics or habit streaks ever land, SQL would have been the better tool
   and this is the one call here that's expensive to reverse. It was made knowingly:
   both features are out of scope, and the Supabase path had never run against a live
   database either, so no proven code was thrown away.
9. **`signInWithPopup`, not `signInWithRedirect`.** Redirect needs cross-origin storage
   access that third-party cookie blocking breaks, and it would need a callback path that
   GitHub Pages would 404 on. It must also be called synchronously from the click handler
   — put an `await` before it and the browser blocks the popup.

---

## 6. Design system — the rules that keep it from regressing

From `frost-design-overhaul.md`, **as amended after the second design pass.**

### The amendment: glow and chroma are different budgets

The original rule was "cyan at full brightness is a scarce resource, budgeted like a
spotlight." That conflated two unrelated things, and following it literally produced a
screen with **0 px² of saturated colour on it** — restraint implemented as dullness. The
tell: the token reserved for the hero, `#b8fdff`, was the *least* colourful cyan in the
set (C\*ab 21 at L\*97 — effectively white). The spotlight was being spent on a
non-colour.

> **Glow** is blurred light. This is the actual AI-slop tell — a `box-shadow` utility
> applied globally. **Budgeted by count: max 2 elements.** Unchanged.
>
> **Chroma** is flat, unblurred, saturated fill. Poster and Swiss-print vocabulary; no
> quantity of it reads as "generated dashboard". **Budgeted by area**, target roughly
> 1.5–3.5% of the viewport at C\*ab ≥ 40. Above ~5% it starts to read neon-template.

Only four things may glow, ever:
1. The hero ring (the only looping animation on the page)
2. Today's card border (static, dimmer than the hero)
3. Focused inputs (on focus only)
4. The Save button on success (one-shot, then flat)

Everything else is flat — but flat no longer means colourless. Checked checkboxes,
primary buttons and the hero arc carry `--color-frost-cyan-200` (`#00efff`) at full
strength, because a fill spends nothing from the glow budget. **The screen deliberately
saturates as the week gets completed.**

Other rules, unchanged: true black `#000000` background; exactly **one** uppercase
element (the "Frost" wordmark); fields are underlines, not boxes; non-today days get no
border and no card; type scale is 12/14/16/20/32/56 and nothing else.

**New floor (the guard only had a ceiling):** any colour meant to be *read at rest* —
not just on hover or focus — must clear ~3:1 contrast for large/decorative elements and
4.5:1 for body text. `--color-frost-cyan-700` (2.7:1) is decoration only and must never
be used as text; that rule exists because `save failed` was once rendered in it.

### Regression guard

The overhaul was driven by measurement, not taste. Re-run this in the browser console
after any visual change — the counts should not creep back up:

```js
(() => {
  const all = [...document.querySelectorAll('body *')].filter(el => !el.classList.contains('frost-mote'));
  let bordered = 0, glowing = 0, uppercase = 0;
  const sizes = new Set();
  for (const el of all) {
    const s = getComputedStyle(el);
    if (['Top','Right','Bottom','Left'].some(d => parseFloat(s['border'+d+'Width'])>0
        && s['border'+d+'Style']!=='none'
        && !/rgba\(0, 0, 0, 0\)|transparent/.test(s['border'+d+'Color']))) bordered++;
    if ((s.boxShadow && s.boxShadow!=='none') || (s.filter||'').includes('drop-shadow')) glowing++;
    if (s.textTransform === 'uppercase' && el.textContent.trim()) uppercase++;
    if (el.textContent.trim() && !el.children.length) sizes.add(s.fontSize);
  }
  return { bordered, glowing, uppercase, sizes: [...sizes].sort((a,b)=>parseFloat(a)-parseFloat(b)),
           bg: getComputedStyle(document.body).backgroundColor };
})()
```

| Metric | Before overhaul | After overhaul | Current | Ceiling |
| --- | --- | --- | --- | --- |
| Bordered | 129 | 21 | **16** | keep ≤ ~25 |
| Glowing | 12 | 1 | **1** | 1–2 |
| Uppercase | 67 | 1 | **1** | 1 |
| Background | `rgb(5,7,10)` | `rgb(0,0,0)` | **`rgb(0,0,0)`** | must stay black |

21 → 16 because the focal card stopped rendering five phantom blank rows, each of which
carried a checkbox square.

**Two known blind spots in this script** — don't read a clean result as proof:
1. It never counts `text-shadow`, so `.frost-hero-text` — an unconditional glow — is
   invisible to it. The honest glow count with motion enabled is 2, not 1.
2. It counts `.frost-today-glow`'s `0 0 0 1px` spread as a glow when it has zero blur and
   is functionally a border.

Most importantly, **it cannot see the defect that caused the second redesign at all.**
Contrast ratio, saturated area and stroke-to-diameter ratio are invisible to a script
that only checks border width, box-shadow and text-transform — a screen can pass every
row above while being unreadable and colourless. Treat it as a guard against
*re-cluttering*, never as design QA.

The 16 borders are 5 checkbox squares + 8 hairline dividers + 3 input underlines —
**zero boxes around content**. That's the property to protect, more than the number.

---

## 7. Testing traps in this environment

Three false failures cost time last session. All are environment artifacts, not bugs:

1. **`document.hasFocus()` is `false`** in the headless preview pane, so `el.focus()`
   and `el.blur()` are no-ops and React's `onBlur` never fires. Commit input edits by
   dispatching `keydown` with `key: 'Enter'` instead.
2. **`prefers-reduced-motion: reduce` is on**, so translation-based animation is
   suppressed and appears "broken". To observe motion, delete the media rule from the
   CSSOM at runtime, then re-read computed styles. **This is not only a test artifact** —
   Windows 11 maps Settings → Accessibility → Visual effects → Animation effects onto the
   same query, so a lot of real users browse with it permanently on and never know. It
   was the likeliest reason the dust looked frozen. Motes now keep a slow opacity breath
   under the preference rather than being killed outright.
3. **`aria-expanded` is not unique to day rows** — the header's week-selector uses it
   too. Scope day-row queries to `document.querySelector('main')`.
4. **`requestAnimationFrame` never fires while the Browser pane is hidden**, so CSS
   transitions freeze at their *starting* value and `getComputedStyle` reports stale
   colours and dash offsets. This looks exactly like a broken style. It cost time this
   session: a checked checkbox read as `rgba(0,239,255,0.03)` — its pre-transition
   colour — while its inline style was plainly `--color-frost-cyan-200`. To read real
   values, inject `*{transition:none !important}` first, then measure. An `async`
   snippet that awaits a rAF will simply time out.
5. **React state updates need a tool-call boundary to flush.** Clicking and then
   asserting inside one `javascript_tool` call sees the old DOM. Split them.

Also: screenshots fail unless the Browser pane is actually displayed. Verify via
`read_page` / `get_page_text` / DOM queries instead.

---

## 8. Not done / open

- **Habit Tracker panel.** Visible in the user's original screenshot; original spec §9
  defers it to v2. Never built. Most likely next feature request.
- **Cloud path untested against a live Firebase project** (§2.3). Both the unconfigured
  and signed-out UI states were verified in-browser; signed-in was not, because it needs
  a real project.
- **No tests.** No test runner is installed. Verification so far has been manual
  in-browser DOM assertions.
- **Bundle is 398 KB / 121.5 KB gzipped.** Slightly *smaller* than the Supabase build
  (430 KB / 122 KB) — `firebase/firestore/lite` plus `firebase/auth` tree-shakes better
  than `@supabase/supabase-js` did. Do not switch to the full `firebase/firestore`; this
  app loads on navigation and writes on a debounce, so it has no use for realtime
  listeners or offline persistence, which is most of the full client's weight.
- **Account deletion** is not implemented. Sign-out is.
- **Spec files untracked.** `frost-week-tracker-spec.md` and `frost-design-overhaul.md`
  sit in the project root uncommitted. The user was asked and hasn't decided.
- **Multi-week analytics, habit streaks, native app** — all explicitly out of scope.

---

## 9. Commands

```bash
npm run dev        # dev server on :5173
npm run build      # type-check + production build to dist/
npm run typecheck  # types only
```

Git identity is set **locally to this repo only**: `BlackFrost8 <joshoffrost8@gmail.com>`.
The repo is public, so that email is visible in commit history — the user chose this
after being offered GitHub's noreply alias.
