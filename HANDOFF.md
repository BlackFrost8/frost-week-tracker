# FROST // WEEK TRACKER — Handoff

Context for picking this project up in a new session. Written 13 Aug 2026,
updated 20 Aug 2026.

---

## 1. Status at a glance

| | |
| --- | --- |
| Repo | https://github.com/BlackFrost8/frost-week-tracker (public) |
| Live URL | https://planner.froststudio.org |
| Local path | `C:\Users\josua\Downloads\LifeOrg` |
| Branch | `main`, synced with `origin/main` at `78e6c7a` (PR #8 merged) |
| Build | Passing (`npm run build`, type-check clean) |
| App works locally | Yes — rendered and verified in-browser |
| **Live site works** | **Yes** — verified 20 Aug, see §2.1 |
| Cloud sync | Configured against the real `frost-week` project and exercised in use |

Both blockers this file was originally written to flag are now closed. The
history since is one hardening pass over the cross-device round trip, then a
polish pass; §2 records what was verified and how.

Local `main` carries everything through PR #8:

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

`gh` **is** installed now (2.97.0), so PRs can be opened from the terminal —
earlier revisions of this file said otherwise. Nothing in the code is
half-finished.

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

## 2. Deployment and cloud — both resolved

*This section used to be a to-do list. Both items are done; it is kept as a record
of what was wrong and how it was verified, because both failures are recurrable.*

### 2.1 The live site — fixed and verified

The site once served the **raw repo** instead of the built app: the browser was handed
`main.tsx`, got MIME type `application/octet-stream`, refused to execute it, and
rendered nothing, with

> Failed to load module script: Expected a JavaScript-or-Wasm module script…

The cause was **Pages set to "Deploy from a branch"**, publishing files verbatim rather
than running the workflow that compiles them. The fix was **Settings → Pages → Build and
deployment → Source → "GitHub Actions"**, and it has been applied.

Verified 20 Aug 2026 against https://planner.froststudio.org:

| Check | Result |
| --- | --- |
| Document + JS + CSS | all `200` |
| Console errors | none |
| Served bundle | `assets/index-hfRQkkoc.js` — **identical hash to a local `npm run build`**, so the deploy is current with `main` |
| Render | full app; header, week nav, day card, intent panel |
| Background | `rgb(0,0,0)` |
| `sign in` control | present, so Firebase config is live rather than local-only |

That bundle-hash match is the cheapest way to confirm a deploy is current — build
locally and compare the filename against the one the site requests.

This was never a code bug. Do not "fix" any recurrence by changing `vite.config.ts`
`base` — that is already correct (`base: './'`, which works on both a project site and a
custom domain).

There are two CNAME files, both intentional:
- `/CNAME` (repo root) — written by GitHub, used by branch-deploy mode
- `/public/CNAME` — copied into `dist/` by Vite so the **Actions** artifact carries the
  domain. This is the one that matters going forward.

### 2.2 Firebase — configured and in use

`f3dac8a` pointed the app at the real **`frost-week`** project, and the eleven commits
after it are that cloud path being exercised against it rather than merely compiled:
sync no longer losing work, local data scoped per uid, the stale starter list cleared,
prefs writes queued so a slow one can't undo a fast one. The single largest untested
risk in this project is no longer untested.

Setup walkthrough, if it ever needs redoing:
[README.md](README.md#sign-in-with-google-5-minutes). Short version: create a project →
enable the Google sign-in provider → add your domain to Authorized domains → create
Firestore → publish [`firestore.rules`](firestore.rules) → paste the six config values
into [`src/lib/firebase-config.ts`](src/lib/firebase-config.ts).

**Supabase was removed** in favour of Firebase (see §5.8). The deciding factor was setup
burden on a static host: Supabase + Google OAuth is ~16 steps across the Supabase
dashboard *and* the Google Cloud Console, because you must create the OAuth client and
copy a client secret yourself. Firebase auto-provisions that OAuth client, so the whole
Cloud Console leg disappears — 7 steps, one website, no secrets, no SQL.

Without config the app falls back to local-only (localStorage, one device) and the
account dialog says so. That fallback is still live code and still correct — it is what
runs if the config is ever emptied.

---

## 3. What it is

A gamified weekly task tracker. 7 days, a checklist per day, completion rings, and a
Focus/Reward/Affirmation panel. It was built from two spec files:

- `frost-week-tracker-spec.md` — the original feature brief
- `frost-design-overhaul.md` — the design system rewrite (superseded the first file's
  visual direction entirely)

**Neither file exists any more** — they were never committed and are no longer on disk.
Where they conflicted, the overhaul won, and what survived of both is §5 and §6 of this
file. Treat those as the source, not a summary of one. The original spec's §9 also declared
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
│   ├── icons.ts           38 monoline glyphs as path data, for group marks
│   └── prefs.ts           Standing tasks + task groups: local-first, mirrored
├── hooks/
│   ├── useAuth.ts         Session state + Profile, Google + email sign in/out,
│   │                      linkPassword() to repair a wiped password (§5.32)
│   ├── useWeek.ts         Current Week + every mutation + debounced autosave
│   ├── useClock.ts        Stopwatch/countdown derived from one epoch timestamp
│   ├── useClickRipple.ts  Capture-phase click bloom, own layer, JS-gated
│   ├── useTheme.ts        Applies + persists the chosen theme
│   └── usePrefs.ts        Loads standing tasks; gates week creation on them
└── components/
    ├── AmbientBackground  Fixed black canvas, cyan wash, 110 drifting motes
    ├── Clock              Wall clock + two-mode timer + portalled focus view
    ├── ThemeDialog        Presets + two-colour picker, opened by SettingsButton
    ├── SettingsButton     The gear: header on desktop, bottom-right on a phone
    ├── WeekStrip          The 7 days, horizontal. Selects; does not expand
    ├── DayCard            The focal card — shows whichever day is selected
    ├── HeroPanel          The signature element — owns the only looping glow
    ├── PaceCurve          Cumulative done vs even pace. Line only, no fill
    ├── IntentPanel        Focus/Reward/Affirmation as statements + clear checks
    ├── ProgressRing       variant: 'hero' | 'quiet'
    ├── TaskRow            Checkbox + inline-editable label + group mark
    ├── GroupPanel         Groups, their week progress, and what is in them
    ├── GroupMenu          The popover that files one task into a group
    ├── GroupDialog        Name + icon-library picker, for making and editing
    ├── TaskIcon           One glyph from lib/icons, in currentColor
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
  xl:  [ HeroPanel + PaceCurve ] [ DayCard ] [ IntentPanel + GroupPanel ]
  md:  [ DayCard ]               [ Hero / Curve / Intent+Groups stacked right ]
  sm:  Hero → DayCard → PaceCurve → IntentPanel → GroupPanel, single column
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
    `rgb(var(--frost-accent-rgb) / a)` when you need an alpha. **Tailwind's own
    colour utilities are the same trap in shorter clothing**: `hover:bg-white/5`
    in the week selector was a white tint that vanished on every light preset,
    which is the one surface where a hover state has to do the most work. Reach
    for `bg-[rgb(var(--frost-far-rgb)/0.05)]` — `far` is white on a dark theme
    and black on a light one, so it dims in whichever direction is away from
    the canvas.
22. **A theme is two colours; the other thirteen are derived.** Presets and the
    two-colour picker both feed one `{primary, accent}` pair through
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

| Metric | Before overhaul | After overhaul | Aug 13 | Aug 20 (empty week) | Ceiling |
| --- | --- | --- | --- | --- | --- |
| Bordered | 129 | 21 | 16 | **2** | keep ≤ ~25 |
| Glowing | 12 | 1 | 1 | **1** | 1–2 |
| Uppercase | 67 | 1 | 1 | **1** | 1 |
| Background | `rgb(5,7,10)` | `rgb(0,0,0)` | `rgb(0,0,0)` | **`rgb(0,0,0)`** | must stay black |

21 → 16 because the focal card stopped rendering five phantom blank rows, each of which
carried a checkbox square.

**The Aug 20 count of 2 is not an improvement — it is a different measurement.** The app
now starts with no tasks, so that run had no checkbox squares and no task dividers to
count. Borders here scale with content. Re-run the guard on **a week with real tasks in
it** before reading anything into the number, or it will keep reporting a flattering 2
forever.

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
28. **`uppercase` lives on the wordmark's `<h1>`, and the mark is not a
    control.** It sat on a `<button>` while the wordmark opened the theme,
    because a button does not inherit `text-transform` — on the h1 it silently
    did nothing and the mark rendered as "Frost". The theme moved to the
    settings gear and the button went with it, so the h1 carries it again.
    Keep it on exactly one element either way: that is what holds the §6
    uppercase count at 1.
29. **Michroma is loaded for the wordmark alone.** One weight, no italic,
    which is fine for five letters. Space Grotesk is the fallback so a blocked
    font CDN — plausible on a school network — degrades to the previous look
    rather than to Times.
30. **The wordmark, the header cluster and the IntentPanel run on the accent
    ramp, not the grey text tiers.** Grey there read as disabled chrome sitting
    next to coloured content. Hierarchy is carried by *position on the ramp*
    instead of by lightness: 500 for quiet verbs (`today`, `reset`, `clear
    checks`, field labels), 300 for the wall clock and `sign in`, 100/050 for
    the numbers and values you actually read. Use ramp tiers there, never
    `text-dim`/`text-faint`.
31. **In the IntentPanel, colour means exactly one thing: grey is an
    unanswered prompt, accent is your own words.** All three fields share the
    same pair. An earlier version walked the three down the accent ramp, which
    looked like a ranking of focus over affirmation — an order that doesn't
    exist. Don't reintroduce a per-field gradient there.
32. **`linkPassword()` repairs a password that signing in with Google wiped.**
    Referenced from §4 and §8; the decision itself was never written down. Fill
    this in from `hooks/useAuth.ts` before those two cross-references rot.
33. **Groups live in prefs, tasks hold only a group's id.** A group outlives
    any one week, so it cannot live in the week document — and storing its name
    or icon on the task would mean renaming "School" had to rewrite every week
    ever saved. Deleting a group cascades into nothing: `groupById` resolves a
    dead id to null on read, on every device, including ones that were offline
    when it went.
34. **`Task.groupId` is `string | null`, never optional.** Week documents are
    written to Firestore verbatim and `setDoc` rejects `undefined` field values
    outright, so an unassigned task must carry an explicit null. `normalizeWeek`
    and `toStandingTask` both force this; don't relax either to `?:`.
35. **Groups have no colour, only a mark.** Every hue is derived from the user's
    two theme colours at runtime, so a stored per-group colour would be the one
    thing on screen a theme change could not reach. Icons stroke in
    `currentColor` and inherit whatever tier they sit in — which is also why
    `lib/icons.ts` is hand-drawn path data rather than an icon package.
36. **The task row's group trigger always wears a plain tag, never the group's
    own glyph.** The mark beside the label already reports which group it is;
    a trigger mirroring it made one row show the same icon twice. Trigger is
    the verb, mark is the answer. `GroupMenu`'s `showCurrent` prop switches
    this, and is true everywhere the row shows no mark of its own.
37. **`TaskRow`'s edit field skips its blur commit when focus moves inside the
    row.** A brand-new row has an empty draft and `commit` deletes those, so an
    unguarded blur deleted the row the instant the group button beside it was
    clicked. `GroupMenu` closes on `pointerdown` rather than `click` for the
    same reason — a click listener fires after the mousedown has already blurred
    the field.
38. **`GroupPanel` fades done rows by opacity, not by dropping a ramp tier.**
    On a light theme the accent ramp runs the other way — 500 mixes toward
    black and lands *darker* than 100 — so a colour swap made completed tasks
    the loudest thing in the panel. Opacity means the same thing on every
    preset.

39. **Changing a standing task's group re-files the matching tasks already on
    the board — in both directions.** Standing tasks are seeded only when a
    week is *created*, so without this you set the mark and the week in front
    of you didn't change. `applyStandingGroups` in `useWeek` never adds,
    removes or renames anything; it only moves tasks between groups, and only
    ones that are either unfiled or still sitting in the group the standing
    task *used to* name. That second clause is the whole rule: an instance you
    moved somewhere else by hand this week is never overruled.
40. **App diffs the standing list and passes `{label, from, to}`, not the
    list.** Handing `applyStandingGroups` the whole list made every standing
    edit re-file every matching task, so taking one task out of a group by hand
    held only until you next touched an unrelated standing task — a control
    that silently undid itself. `from` is what earned un-filing: with only the
    new value, the sweep could either overwrite everything or refuse to touch
    anything already filed, and it chose the latter — so choosing "no group"
    left every instance on the board still wearing the old mark, with nothing
    but seven visits to seven days to clear it. That was the reported bug.
    The first map seen after load is recorded without being applied, because
    prefs arrive async and every load starts as `[]`; reading that as an edit
    would re-file on every refresh. The baseline is also **dropped** whenever
    `ready` or the week goes false — the next list to arrive belongs to a
    different session, and diffing across a sign-in would file this week's
    tasks into another account's group ids.
41. **`mutate` returns early when `fn` hands back the same week reference.**
    That is what makes an idempotent reconcile free — no bumped `editSeq`
    (which would discard an in-flight load) and no scheduled write. The helpers
    it depends on return identical references when they change nothing, so
    don't "tidy" them into always spreading a new object.

42. **The theme opens from the settings gear, and the wordmark is only a
    name.** Putting it behind the mark meant the only way to find it was to
    try clicking a heading. The gear renders twice — in the header from `sm`
    up, fixed bottom-right below it, mirroring the info button opposite — and
    each hides at the breakpoint the other takes over, so exactly one is ever
    on screen. `.frost-wordmark` lost its `:hover` for the same reason: a
    heading that lit up under the cursor promised a click that does nothing.
43. **`ThemeDialog` has no "advanced" disclosure.** Two colours and a name is
    not advanced, and hiding it behind that word hid the more interesting half
    of the feature. Everything shows at once in a `max-w-md` panel; the
    dialog's `overflow-y-auto` + `my-auto` is what keeps `done` reachable now
    that it is always the taller layout.
44. **Replacing a preset does not strip it from anyone using it.** `Coffee`
    became `Nature`, and a device still holding `presetId: 'coffee'` keeps its
    exact colours and name — `loadTheme` stores the spec, so it simply reads
    as a custom theme with no preset row highlighted. Verified in-browser.
    Don't add a migration that "fixes" those devices onto a preset they never
    chose.
45. **A new preset has to clear the §6 contrast floor, not just look right.**
    Nature's first accent (`#4ade80`) derived a `cyan-500` of 4.30 against its
    own canvas — under 4.5, and that tier is text (`today`, `clear checks`,
    panel labels). `#57e88f` takes it to 4.68. Measure before shipping one.
46. **`applyStandingTasks` builds its label→group map once per sweep.** It was
    being rebuilt inside `day.tasks.map`, so "add these to this week" on a
    seventy-row week built the same Map seventy times. Harmless in effect and
    pointless in fact — hoist anything derived from `standing` above the walk.

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

*Re-verified against the code and the live site on 20 Aug 2026.*

### Closed since this file was written

- **~~Live site blocked~~** — fixed and verified, §2.1.
- **~~Cloud path untested~~** — configured and exercised against `frost-week`, §2.2.
- **~~Page gutter never confirmed~~** — `.frost-shell` carries `padding-inline:18px`
  (32px at the wider breakpoint) in the built CSS, and a freshly-created probe element
  reads back 18px on the live site at 375px wide. See the caveat under *Still unseen*.
- **~~Spec files untracked~~** — moot in the worst way: `frost-week-tracker-spec.md`
  and `frost-design-overhaul.md` are **no longer on disk at all**, and were never
  committed. The design rules that survived them live in §5 and §6 of this file, which
  is now the only record. Treat §6 as the source of truth, not a summary of one.

### Still open

- **Habit Tracker panel.** Visible in the user's original screenshot; original spec §9
  defers it to v2. Never built — no reference to it anywhere in `src/`. Still the most
  likely next feature request.
- **No tests.** No test runner is installed; `package.json` has no `test` script.
  Every verification in this project's history has been manual in-browser DOM
  assertion, which is exactly the kind of check that doesn't survive a refactor.
  **This is the largest remaining structural gap** — see the readiness note below.
- **Account deletion** is not implemented. Sign-out is. Worth knowing if this ever
  needs to answer a data-deletion request.
- **The password-linking repair (§5.32) has never been run end to end.** The code
  builds and the signed-out error path was verified in-browser against the live
  project, but linking itself needs a signed-in session, which no session so far has
  had. First run is unproven; `auth/requires-recent-login` is the likeliest snag and
  is already mapped to a message that says what to do.
- **No PRODUCT.md.** There is no captured product truth, so each session re-infers
  intent from the code. Cheapest available improvement to how the project is worked on.
- **`PaceCurve` returns `null` when the week has no tasks at all** ([PaceCurve.tsx:22](src/components/PaceCurve.tsx:22)),
  so the left rail is short on a genuinely empty week. Since the app now *starts*
  empty rather than seeded, this is the first-run desktop state, not an edge case.
- **The row tools are three 24px targets on touch.** Groups added a third
  button beside edit and delete, and on a phone all three are permanently
  visible at ~28px pitch — under the 44px touch minimum the week strip is held
  to. `group` is placed furthest from `delete`, so a mis-tap lands on `edit`
  rather than on the one destructive control. Worth revisiting as a row-level
  overflow menu if it bites.
- **Multi-week analytics, habit streaks, native app** — all explicitly out of scope.

### Still unseen

- **No screenshot of the app has ever been taken.** Screenshots fail in this
  environment whenever the Browser pane isn't displayed, which has been every session
  so far. Everything — layout, gutter, the whole visual design — has been verified
  through DOM measurement and the built CSS, never with eyes. The measurements are
  sound and §7.6's probe technique works, but **no automated check in this project can
  see a visual defect**, only a structural one. One human look on a real phone would
  retire more risk than any amount of further DOM querying.

### Bundle

**448 KB / 135.8 KB gzipped** (was 398 KB / 121.5 KB when this file was written; the
profile-picture, dialog and theming work since accounts for the ~14 KB gzipped). Still
comparable to the old Supabase build (430 KB / 122 KB). Do not switch to the full
`firebase/firestore`: this app loads on navigation and writes on a debounce, so it has
no use for realtime listeners or offline persistence, which is most of the full
client's weight.

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
