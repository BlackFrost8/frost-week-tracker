# FROST // WEEK TRACKER — Handoff

Context for picking this project up in a new session. Written 13 Aug 2026.

---

## 1. Status at a glance

| | |
| --- | --- |
| Repo | https://github.com/BlackFrost8/frost-week-tracker (public) |
| Live URL | https://planner.froststudio.org |
| Local path | `C:\Users\josua\Downloads\LifeOrg` |
| Branch | `main` — the design branch was fast-forwarded into it, **not pushed yet** |
| Build | Passing (`npm run build`, type-check clean) |
| App works locally | Yes — rendered and verified in-browser |
| **Live site works** | **No — blocked on one GitHub setting, see §2** |
| Cloud sync | Code complete, **never configured or tested against a real project** |

Local `main` now carries everything:

| | |
| --- | --- |
| `b0b3305` | Original build |
| `d3d9872` | First redesign — true black, budgeted glow |
| `05fdbdd` | This file |
| `6a21b36` | Chroma budget, Google login, add-task clutter |
| `60ea184` | Layout: week strip, three regions, spacing cadence |
| `5547f3a` | Local-first sync, cross-device fixes, clock/timer, click ripple |
| `6caa906` | Typed countdown length, full-screen timer focus view |
| *(latest)* | Themes behind the wordmark, standing tasks in account settings |

No PR is needed — the design work is on `main` now. **`gh` is not installed on
this machine.** Nothing in the code is half-finished.

### What the latest commit changed, and why

A council review traced the school-Chromebook → home-PC round trip and found
four ways to lose work. All four are fixed; the reasoning is in §5.

1. **`cloudStore` is now local-first.** Every save writes localStorage
   synchronously *before* the network, and a week the cloud rejected stays
   flagged `dirty` and is retried by `flushPending()`. Previously, signing in
   converted a save that could not fail into a bare network call whose entire
   failure handling was one dim word in the header.
2. **The tab re-reads on focus/visibility.** This is the whole mechanism by
   which one device sees another's work; without it a tab showed its mount-time
   snapshot forever and the next click uploaded that stale week over the newer
   one.
3. **Migration is gated.** `ready` stays false until migration for the signed-in
   uid finishes, so the first sign-in can't upload real weeks and then overwrite
   them with a blank starter week.
4. **Local data is uid-scoped.** Signed-in work mirrors to
   `frost-week-tracker:mirror:{uid}`, so signing out no longer shows the
   previous person's tasks on a shared device.

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
│   ├── firebase-config.ts The six pasted values — the only setup step in the app
│   ├── theme.ts           Presets + the colour maths that derives a whole palette
│   └── prefs.ts           Standing tasks: local-first, mirrored to the account
├── hooks/
│   ├── useAuth.ts         Session state + Profile, Google + email sign in/out
│   ├── useWeek.ts         Current Week + every mutation + debounced autosave
│   ├── useClock.ts        Stopwatch/countdown derived from one epoch timestamp
│   ├── useClickRipple.ts  Capture-phase click bloom, own layer, JS-gated
│   ├── useTheme.ts        Applies + persists the chosen theme
│   └── usePrefs.ts        Loads standing tasks; gates week creation on them
└── components/
    ├── AmbientBackground  Fixed black canvas, cyan wash, 110 drifting motes
    ├── Clock              Wall clock + two-mode timer + portalled focus view
    ├── ThemeDialog        Presets + advanced two-colour picker, behind the wordmark
    ├── WeekStrip          The 7 days, horizontal. Selects; does not expand
    ├── DayCard            The focal card — shows whichever day is selected
    ├── HeroPanel          The signature element — owns the only looping glow
    ├── PaceCurve          Cumulative done vs even pace. Line only, no fill
    ├── IntentPanel        Focus/Reward/Affirmation as statements + clear checks
    ├── ProgressRing       variant: 'hero' | 'quiet'
    ├── TaskRow            Checkbox + inline-editable label
    ├── Header             Wordmark, week nav, profile (avatar + first name)
    ├── AccountDialog      Google sign-in + profile card; also exports `Avatar`
    └── GoogleMark         The official "G", used inside our own button
```

`TodayCard`, `DayRow` and `ControlPanel` were deleted in the layout pass — they
are `DayCard`, `WeekStrip` and `IntentPanel` now. Don't resurrect them.

### Layout regions

```
              ┌──────────────── header ────────────────┐   96px below
              ├────────────── WeekStrip ───────────────┤   full bleed, 7 cells
  xl:  [ HeroPanel + PaceCurve ] [ DayCard ] [ IntentPanel ]
  md:  [ DayCard ]               [ Hero / Curve / Intent stacked right ]
  sm:  Hero → DayCard → PaceCurve → IntentPanel, single column
```

The shell is `.frost-shell` (plain CSS in `index.css`, **not** utilities) at
`max-width: 1600px`. DOM order is Hero, DayCard, Curve, Intent; the two
read-only blocks are the ones whose grid placement moves between breakpoints,
so visual order never disagrees with keyboard order for anything focusable.

`localStore` and `cloudStore` both implement `WeekStore`. **No component knows which is
active** — `App.tsx` picks one based on auth state and passes it to `useWeek`. Keep it
that way; it's what makes the offline→cloud upgrade seamless, and it's why swapping
Supabase for Firestore touched only `storage.ts` and left `useWeek` and every component
alone.

Cloud documents live at `users/{uid}/weeks/{weekStart}` — the week start is the document
id, so `listWeekStarts` is a pure id read needing no query or index.

`cloudStore` is **local-first**: it is `localStore` scoped to a uid, plus a Firestore
mirror. It is not a replacement for local storage, and must not be turned back into one
— that was the single largest data-loss risk in the app.

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
9. **The strip selects, it does not expand.** Days used to expand inline. One
   card in one place means one text measure for every task, and it fixes a
   state that was previously broken: a week not containing today rendered *no
   card at all*. `App.tsx` holds `selected: DayId`, defaulting to today or to
   Monday.
10. **An unplanned day renders as a hairline, not a 0% bar.** `completionPct`
    returns 0 for both "nothing planned" and "planned, did nothing" — opposite
    states that must not share a glyph. `WeekStrip` branches on `totalCount`.
11. **Intent fields autosave; there is no Save button.** Everything else in the
    app autosaves, so a Save governing only three fields was the odd one out.
    This retired one of the four permitted glow slots — the budget got cheaper,
    not more expensive.
12. **The hero is 176px, deliberately smaller than it was.** At 244px it won
    the squint test against the checkboxes, which is the actual job on an
    Operate surface. It still owns the only glow. Signature and dominant are
    separable — don't "fix" this by enlarging it.
13. **`signInWithPopup`, not `signInWithRedirect`.** Redirect needs cross-origin storage
   access that third-party cookie blocking breaks, and it would need a callback path that
   GitHub Pages would 404 on. It must also be called synchronously from the click handler
   — put an `await` before it and the browser blocks the popup.
14. **Email/password sign-in exists alongside Google on purpose.** It is folded
    behind "use an email and password instead" and looks redundant. It is the
    fallback for a managed school Chromebook that blocks third-party OAuth
    consent or popups — the one device where Google sign-in failing would make
    the whole app pointless. Requires Email/Password enabled in the Firebase
    console alongside Google.
15. **The click ripple checks `prefers-reduced-motion` in JS, per click, and
    skips creating the node.** Suppressing it the way every other animation is
    suppressed (`animation: none`) would mean `animationend` never fires, its
    cleanup never runs, and a glowing dot sticks to the screen permanently. The
    CSS `display: none` under that media query is belt-and-braces, not the
    mechanism.
16. **The ripple listens in the capture phase.** `TaskRow` and `AccountDialog`
    call `stopPropagation()` in the bubble phase for their own logic, so a
    normal listener would go dead on checkboxes, edit/delete and modal content —
    the most-clicked things in the app. It never calls `preventDefault` or
    `stopPropagation` itself, so it cannot break anything downstream.
17. **The timer derives from `Date.now()`; it never accumulates ticks.** Chrome
    throttles background-tab timers hard, so a tick counter comes back minutes
    short after a closed lid. The interval only decides *when to re-render*.
    `performance.now()` is not an option — it resets on every navigation and so
    cannot be persisted.
18. **Timer state is device-local and never synced.** A timer is about the room
    you're in; syncing it would mean pausing at home stops a run at school.
19. **A single click on the countdown digits is delayed 220ms; on the stopwatch
    it is not.** Double-clicking to edit the length also fires two ordinary
    clicks, which would start and immediately pause the countdown on the way
    past. The delay is the guard, and it only applies where double-click means
    something — the stopwatch has no duration to edit, so it toggles instantly.
20. **The focus view's numerals are off the type scale, deliberately.** The
    scale tops out at 56px, and `clamp(64px, 15vw, 200px)` is well past it.
    This is a single-purpose surface with nothing else on screen — a scale
    exists to keep a *composition* coherent, and there is no composition here
    to violate. It costs the standing count nothing either way: the overlay is
    portalled and unmounted when closed, so a guard run at rest sees exactly
    the same five sizes as before. Don't extend the shared scale to cover it.

---
21. **The palette is now runtime-driven, and §6's token values are defaults
    rather than constants.** `lib/theme.ts` overwrites every `--color-frost-*`
    token as an inline property on `<html>` before React mounts. The values in
    `@theme` and `:root` are the Frost theme, kept accurate so the stylesheet
    is right on its own if JS never runs. **This is why no colour may be
    hardcoded in a component any more** — a literal `#00efff` or
    `rgba(0,239,255,…)` is invisible to theming and will simply stay cyan while
    everything around it changes. Use the tokens, or
    `rgb(var(--frost-accent-rgb) / a)` when you need an alpha.
22. **A theme is two colours; the other thirteen are derived.** Presets and the
    advanced picker both feed one `{primary, accent}` pair through
    `deriveTheme`. Every text tier is mixed *towards the end of the scale
    opposite the canvas*, which is what makes a light primary flip the whole app
    to dark text with no `if (light)` anywhere in a component. Don't add
    hand-tuned per-theme overrides; fix the derivation instead.
23. **`--frost-on-accent` breaks ties towards white (the 1.2 factor).** A
    saturated mid blue scores 4.60 against black and 4.56 against white — a
    rounding error that would otherwise put muddy black text on every button.
24. **The theme is device-local; standing tasks are account-level.** Not an
    inconsistency. A theme is about the screen and the room — you may well want
    Office on a bright school Chromebook and Frost at night. Standing tasks are
    *content*, so they sync, or setting them up on the PC would leave the
    Chromebook still typing them by hand, which is the point of the feature.
25. **Standing tasks are applied at week creation only, never retroactively.**
    `createWeek(weekStart, starter)` seeds them; `normalizeWeek` deliberately
    calls `createWeek(weekStart)` with no starter, because a week arriving from
    storage must be reconstructed exactly as saved. Editing the list must never
    reach back into weeks you've already worked on.
26. **`usePrefs` gates `ready`, and `useWeek` reads the list through a ref.**
    The gate stops a brand-new week being built empty before the list has
    loaded; the ref stops an edit to the list re-running the load effect and
    swapping the week out from under someone mid-keystroke.

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

### Spacing cadence

Spacing had fourteen ad-hoc values and no rule, while type was pinned to six and
enforced. Three structurally different boundaries — header→intent, intent→work,
today→rest — all rendered at 48/48/40, so nothing told you which mattered. The
scale is now roughly 2x per nesting level:

```
 12  task -> task            (the fixed point; it was always right)
 24  group -> group
 48  block -> block, and every grid gap
 96  chrome -> work          (the largest interval on the page)
```

### Dead width

`max-w-6xl` (1152px) was capping the shell on every desktop: 40% of a 1920
viewport and **55% of a 1440p one** was empty side margin. Now `1600px`, which
puts it at ~17% at 1920. The horizontal `WeekStrip` is what earns that width —
no text measure grew. The card is capped at 660px and centred, so surplus width
becomes symmetric gutter rather than a hole beside a 490px text measure.

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

27. **`StandingTasks` has no effect syncing `draft` back from its `tasks` prop,
    and must not grow one.** It had one, and it was a bug: `onSave` strips
    blank rows before persisting, so 600ms after pressing "add a standing
    task" the round-trip deleted the empty row you were about to type into.
    The dialog unmounts the component when it closes, so initialising state
    from the prop is the only sync required.
28. **`uppercase` lives on the wordmark's `<button>`, not its `<h1>`.** A
    button does not inherit `text-transform`, so on the h1 it silently did
    nothing and the mark rendered as "Frost". Keeping it on exactly one
    element also keeps the §6 uppercase count at 1 — don't put it on both.
29. **Michroma is loaded for the wordmark alone.** One weight, no italic,
    which is fine for five letters. Space Grotesk is the fallback so a blocked
    font CDN — plausible on a school network — degrades to the previous look
    rather than to Times.
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
6. **`getComputedStyle` goes stale on existing elements when the pane is hidden.**
   This is the big one — it cost most of a session. With the pane not displayed
   the page stops compositing frames, and computed *layout* values freeze at the
   last paint. The tell: a freshly created probe element with an identical class
   string returns the correct value while the real element returns the old one,
   and even `el.style.paddingLeft = '18px'` reads back as `0px`. If you see a
   value that is arithmetically impossible, suspect this before suspecting the
   CSS. Verify against the built files instead.
7. **Tailwind v4 emits range media queries.** `grep '@media (min-width'` over
   `dist/assets/*.css` returns **zero matches** and looks like catastrophic
   breakage. The real output is `@media (width>=40rem)`. Likewise, a CSSOM walk
   that doesn't descend into `CSSLayerBlockRule` will find no utilities at all,
   because everything lives inside `@layer utilities`. Both of these produced
   convincing false alarms.
8. **The dev server's Tailwind scan goes stale after new classes are added.**
   Classes written this session may be missing from the dev CSS while being
   present in `dist`. When a utility mysteriously doesn't apply, rebuild and
   check `dist/assets/*.css` before changing code. Use the `frost-preview`
   launch config (`npm run preview`, port 4173) to inspect the real build.

Also: screenshots fail unless the Browser pane is actually displayed. Verify via
`read_page` / `get_page_text` / DOM queries instead — and see trap 6 for how far
to trust those.

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
- **The rendered page gutter was never visually confirmed.** `.frost-shell`'s
  padding is correct in the built CSS and is unlayered so nothing can override
  it, but the pane stopped compositing before it could be seen. **Look at this
  on a phone first thing** — if content touches the screen edge, that rule is
  where to look.
- **No screenshot of the new layout exists.** Everything was verified through
  DOM measurement and the built files.
- **`PaceCurve` returns `null` when the week has no tasks at all**, so the left
  rail is short on a genuinely empty week. Acceptable, but it is the emptiest
  reachable desktop state now.
- **No PRODUCT.md.** The Impeccable skill flagged this: there is no captured
  product truth, so each session re-infers intent from the code. `$impeccable
  init` would fix it and is the cheapest next improvement to how this project
  is worked on.
- **Spec files untracked.** `frost-week-tracker-spec.md` and `frost-design-overhaul.md`
  sit in the project root uncommitted. The user was asked and hasn't decided.
- **Multi-week analytics, habit streaks, native app** — all explicitly out of scope.

---

## 9. Commands

```bash
npm run dev        # dev server on :5173  (CSS can go stale — see §7.8)
npm run build      # type-check + production build to dist/
npm run typecheck  # types only
npm run preview    # serve the real build on :4173 — trust this one
```

`.claude/launch.json` has both `frost-dev` and `frost-preview` configured.

Git identity is set **locally to this repo only**: `BlackFrost8 <joshoffrost8@gmail.com>`.
The repo is public, so that email is visible in commit history — the user chose this
after being offered GitHub's noreply alias.
