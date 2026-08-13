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

### 2.3 Set up Supabase (never done — cloud sync is untested)

Full walkthrough in [README.md](README.md#cloud-sync-5-minutes). Short version:
create a project → run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor →
copy Project URL + `anon public` key → paste via the app's "sync devices" link, or into
`.env`.

Until this is done the app runs local-only (localStorage, one device). **The entire
cloud path — sign-up, sign-in, upsert, RLS, migration — has only been verified as
compiling, never against a live database.** Treat first-run there as unproven.

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
│   └── supabase.ts        Client; env config OR in-app runtime config
├── hooks/
│   ├── useAuth.ts         Session state, sign in/up/out
│   └── useWeek.ts         Current Week + every mutation + debounced autosave
└── components/
    ├── AmbientBackground  Fixed black canvas, cyan wash, 30 drifting motes
    ├── HeroPanel          The signature element — owns the only looping glow
    ├── TodayCard          The one bordered/glowing card, task list open
    ├── DayRow             Non-today days: borderless, collapsed, expand on click
    ├── ProgressRing       variant: 'hero' | 'quiet'
    ├── TaskRow            Checkbox + inline-editable label
    ├── ControlPanel       Focus/Reward/Affirmation + Save/Clear
    ├── Header             Wordmark, week nav, account
    └── AccountDialog      Sign in / sign up / connect database
```

`localStore` and `cloudStore` both implement `WeekStore`. **No component knows which is
active** — `App.tsx` picks one based on auth state and passes it to `useWeek`. Keep it
that way; it's what makes the offline→cloud upgrade seamless.

---

## 5. Decisions that look wrong but aren't

Don't "fix" these without reading why.

1. **Blank task rows are excluded from every count.** A day ships with 10 rows, ~5
   prefilled. Counting blanks would make a fresh day read `0/10` with 5 phantom tasks.
   See `realTasks()` in `lib/week.ts`.
2. **Derived stats are never stored.** Completion %, Completed/Left are recomputed on
   every render so they cannot drift from the checkboxes. Don't cache them into `Week`.
3. **Dates are local-time, serialised `YYYY-MM-DD`.** `fromISODate` parses manually
   because `new Date("2026-08-10")` is treated as UTC and shifts the day in some
   timezones. Don't replace it with `new Date(iso)`.
4. **`base: './'` in vite.config.** Correct for both a Pages project site and the custom
   domain. Not the cause of the blank screen.
5. **The Supabase `anon` key is safe to commit.** RLS policies restrict every row to
   `auth.uid()`. `service_role` is the one that must never be committed; the app never
   uses it.
6. **Pending saves flush before a week switch.** `useWeek` keys each debounced write to
   its originating week, so a toggle made milliseconds before navigating still lands on
   the old week. This was explicitly tested. Don't simplify the debounce away.
7. **Weeks are created in memory and only persisted on first edit.** Navigating through
   empty weeks doesn't litter the database.

---

## 6. Design system — the rules that keep it from regressing

From `frost-design-overhaul.md`. The core idea: **cyan at full brightness is a scarce
resource, budgeted like a spotlight.**

Only four things may glow, ever:
1. The hero ring (the only looping animation on the page)
2. Today's card border (static, dimmer than the hero)
3. Focused inputs (on focus only)
4. The Save button on success (one-shot, then flat)

Everything else is flat. Other rules: true black `#000000` background; exactly **one**
uppercase element (the "Frost" wordmark); fields are underlines, not boxes; non-today
days get no border and no card; type scale is 12/14/16/20/32/56 and nothing else.

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

| Metric | Before overhaul | Current | Ceiling |
| --- | --- | --- | --- |
| Bordered | 129 | 21 | keep ≤ ~25 |
| Glowing | 12 | 1 | 1–2 |
| Uppercase | 67 | 1 | 1 |
| Background | `rgb(5,7,10)` | `rgb(0,0,0)` | must stay black |

The 21 borders are 10 checkbox squares + 8 hairline dividers + 3 input underlines —
**zero boxes around content**. That's the number to protect.

---

## 7. Testing traps in this environment

Three false failures cost time last session. All are environment artifacts, not bugs:

1. **`document.hasFocus()` is `false`** in the headless preview pane, so `el.focus()`
   and `el.blur()` are no-ops and React's `onBlur` never fires. Commit input edits by
   dispatching `keydown` with `key: 'Enter'` instead.
2. **`prefers-reduced-motion: reduce` is on**, so every animation is correctly
   suppressed and appears "broken". To observe motion, delete the media rule from the
   CSSOM at runtime, then re-read computed styles.
3. **`aria-expanded` is not unique to day rows** — the header's week-selector uses it
   too. Scope day-row queries to `document.querySelector('main')`.

Also: screenshots fail unless the Browser pane is actually displayed. Verify via
`read_page` / `get_page_text` / DOM queries instead.

---

## 8. Not done / open

- **Habit Tracker panel.** Visible in the user's original screenshot; original spec §9
  defers it to v2. Never built. Most likely next feature request.
- **Cloud path untested against a live database** (§2.3).
- **No tests.** No test runner is installed. Verification so far has been manual
  in-browser DOM assertions.
- **Bundle is 430 KB / 122 KB gzipped**, mostly `@supabase/supabase-js`. Fine for now;
  code-split the auth path if it ever matters.
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
