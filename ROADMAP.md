# Roadmap: bugs, improvements, revenue

Written 4 Nov 2026 from a full read of `src/`, a clean `npm run build`, and a
short survey of what planner users ask for and what comparable apps charge.
Items are ordered by priority within each section. File references point at
the code as of `2b73a54`.

---

## 1. Bugs (confirmed by reading the code)

> **Status, 5 Nov 2026:** 1.1–1.7 are fixed, along with the stale comments in
> 1.8. Each sync fix is covered by a test in `src/lib/*.test.ts` that fails on
> the old code. Run `npm test`. CI now runs the tests before deploying. Still
> open from 1.8: bundle size, HANDOFF §5.32, and size limits in
> `firestore.rules`.

### 1.1 Groups, standing tasks and goals made while signed out vanish on first sign-in — **high** — ✅ fixed

`migrateLocalToCloud` moves signed-out *weeks* into the account. Nothing moves
signed-out *prefs*. `loadPrefs` (`src/lib/prefs.ts:331`) reads only the
uid-scoped key, `frost-week-tracker:prefs:{uid}`, and never the anonymous
`frost-week-tracker:prefs`.

Result: someone sets up groups, a routine and goals before signing in, then
signs in. Their weeks arrive, but every task's `groupId` now points at a group
the account doesn't have, so every group mark goes. The routine and the goals
are gone from view too. The anonymous prefs stay in localStorage, unreachable
and never cleared, which is also a leak on a shared device.

**Fix:** on first sign-in, if the account has no prefs document, seed it from
the anonymous prefs and then clear the anonymous key. Reuse the `migrated:{uid}`
flag that weeks already use.

### 1.2 One device's stale prefs overwrite another device's newer ones — **high** — ✅ fixed

Weeks re-read on focus. Prefs don't: `usePrefs` loads once per
`[authReady, uid]` (`src/hooks/usePrefs.ts:22`), and every `updatePrefs` writes
the **whole** document from that in-memory copy (`src/lib/prefs.ts:419`).

Scenario: the PC tab has been open since Monday. On Wednesday the Chromebook
adds a group. On Thursday, back on the PC, ticking a long-term goal writes the
PC's Monday copy of prefs, which deletes Wednesday's group without any error.
That is the same failure §1 of HANDOFF.md fixed for weeks, and it is still
present for prefs.

**Fix (pick one):**
- Re-read prefs on focus/visibility, the same way `useWeek` does. Cheapest.
- Write only the field that changed (`updateDoc(prefsDoc, { goals })`) instead
  of `setDoc` on the whole document. Then two devices editing different fields
  can't collide at all. Best.

### 1.3 Offline prefs edits are discarded on the next online load — **medium** — ✅ fixed

`loadPrefs` always lets the cloud copy win (`src/lib/prefs.ts:355`). Weeks have
a `dirty` flag and a timestamp, so a newer unsynced local edit survives. Prefs
have neither. If you edit standing tasks or goals while the Chromebook has no
connection, then reload once it reconnects, those edits are overwritten by the
older cloud copy.

**Fix:** give prefs the same `{updatedAt, dirty}` meta that weeks use, and the
same "local wins only if dirty and newer" rule.

### 1.4 The conflict rule trusts each device's own clock — **medium** — ✅ fixed

`updatedAt` comes from `new Date()` on whichever device made the edit
(`src/lib/storage.ts:68`), and `loadWeek`/`flushPending` compare those strings
(`src/lib/storage.ts:287`). A school Chromebook whose clock runs a few minutes
fast will win against newer work from a correctly set PC. Each week is also
resolved last-writer-wins as one document, so two devices editing the same
week offline lose one side completely, with no merge.

**Fix:** stamp the cloud copy with `serverTimestamp()`. Keep a per-device
"last cloud version seen" and compare against that instead of wall-clock time.
A per-task merge is the full fix, but it's probably not worth building until
someone actually reports this.

### 1.5 First sign-in silently deletes signed-out work for any week the account already has — **medium** — ✅ fixed

`migrateLocalToCloud` skips a week the account already holds
(`src/lib/storage.ts:429`), then wipes the whole anonymous blob
(`src/lib/storage.ts:447`). Say you used the app signed out on a new device
this Monday, then signed in, and your account already had this week from
another device. Every task you typed while signed out is destroyed, and
nothing tells you.

**Fix:** merge the two copies' tasks instead of dropping one. Failing that,
keep the skipped weeks under a recoverable key and tell the user.

### 1.6 Timed calendar events only appear on their start day — **low** — ✅ fixed

`toEvents` (`src/lib/gcal.ts:170`) splits only *all-day* events across days. A
timed event from Friday 22:00 to Sunday 10:00 shows on Friday and nowhere else.

### 1.7 The calendar import goes stale without saying so — **low** — ✅ fixed

Auto-refresh only happens while the tab still holds an access token, which
lasts about an hour. After that the imported events stay fixed until someone
opens settings and clicks refresh, and the only sign of their age is a faint
timestamp inside that dialog. Show "imported 3 days ago" on the day card when
the import is more than about a day old.

### 1.8 Housekeeping

- The bundle is **510 KB / 152 KB gzipped**, and Vite now warns about it.
  HANDOFF.md still says 448 KB. Lazy-load `AccountDialog`, `Tour`,
  `ThemeDialog` and `lib/gcal`, since none of them is needed for the first paint.
- Two comments describe an empty-day "what you did last weekday" prompt that
  doesn't exist (`src/lib/prefs.ts:150`, `src/App.tsx:256`). Build the feature
  or delete the comments.
- HANDOFF §5.32 is still a stub that says "fill this in".
- `firestore.rules` checks ownership but not size or shape. A signed-in user
  can write anything, at any size, under their own uid. That's low risk on the
  free plan, but it costs money on a paid one.

---

## 2. Structural gaps

1. **~~No tests.~~ Started.** Vitest is in, with 17 tests over merging,
   calendar splitting, week sync, prefs sync and migration. Still untested:
   the hooks and components. Original note: the sync code (`storage.ts`, `prefs.ts`) is the most
   intricate code in the repo, and it has the most "this was a data-loss bug"
   comments. Add Vitest and cover `normalizeWeek`, the week maths, and the
   `loadWeek`/`flushPending` decision table with Firestore stubbed out. Bugs
   1.2–1.5 are all things a test table would have caught.
2. **Not installable, and doesn't load offline.** There's no web manifest and
   no service worker. The data is stored offline, but the *page* won't open
   without a network connection, which defeats local-first on a phone or a
   school Chromebook. A manifest plus a precaching service worker (for example
   `vite-plugin-pwa`) gets home-screen install and offline start. It is also
   the cheapest route to "an app" without the app stores.
3. **No account deletion or data export.** Sign-out exists; delete doesn't.
   Both are expected by anyone who reads the privacy policy, and deletion is
   mandatory if this is ever wrapped for an app store. Export is one
   `JSON.stringify` of weeks and prefs.
4. **The Google Calendar import will stop working at 100 users.**
   `calendar.readonly` is a *sensitive* scope. Until the OAuth consent screen
   passes Google's verification, users see an "unverified app" warning and the
   project is capped at 100 new users. After that, the calendar connection
   fails for everyone new. Verification for sensitive (not restricted) scopes
   needs a verified domain, the privacy policy (already done), and a short
   demo video. It costs nothing but can take weeks. **Start it before any
   growth push.**

---

## 3. Features users actually ask for

This draws on planner-app threads and feature-request boards. The signal is
thin but consistent:

| Ask | Status here | Note |
| --- | --- | --- |
| Move unfinished tasks forward | Partial: within the same week only (`moveTask`) | Users want it **controllable, not automatic**. The loudest complaint about rollover is that it makes you feel permanently behind. Add an end-of-week "carry these 4 into next week?" with per-task choice, plus "move to next week" in the day menu. Don't roll over automatically. |
| Recurring tasks | Partial: standing tasks repeat weekly on chosen weekdays | Missing: every-other-week, monthly, and date-specific ("every 1st"). |
| Reorder tasks | Missing | Keyboard (Alt+↑/↓) and drag-and-drop. |
| Undo | Missing | Delete is one tap on a phone, with no way back. A 5-second "undo" toast covers delete, clear checks and move. |
| Habit tracker / streaks | Missing (HANDOFF lists it as the likeliest next request) | A streak is a cross-week query. That's cheap with ≤ 52 week docs, so Firestore isn't a blocker yet. |
| Reminders | Missing | Web push needs the service worker from §2.2. |
| Subtasks | Missing | Popular, but it adds weight. Do it only if people ask for it. |
| Two-way calendar | Read-only import | Writing tasks back to Google Calendar is a natural paid feature (see §4). |

Already ahead of most competitors: calendar import, privacy curtain, focus
timer, theming, groups that report across weeks, and an offline-first design.

---

## 4. Revenue: the practical version

### The honest constraint

Revenue is roughly users × conversion. Freemium planners typically convert a
low single-digit percentage of active users. At 100 active users that means
2–5 paying users, so **distribution is the bottleneck, not pricing.** Any
money plan that doesn't also fix installability (§2.2) and the 100-user OAuth
cap (§2.4) is a plan for a paywall nobody reaches.

Market reference points:
- Tweek, the closest analogue (a minimal weekly planner): free core, Premium
  about **$5.99/mo or $49.99/yr**. Premium includes calendar sync.
- Sunsama, a heavyweight daily planner with rituals and integrations:
  **about $17–25/mo**. It isn't the same market, but it shows the ceiling.

### Recommended: a small freemium tier, "Frost Pro"

- **Price:** about $3/mo or $24/yr, plus a lifetime option around $39. The
  users this app was built for are students on school Chromebooks. They resist
  subscriptions and respond well to a one-off purchase.
- **Free forever:** everything that exists today, apart from the calendar
  limits below. Taking away something people already have destroys goodwill
  for little money.
- **Pro:**
  - Calendar: automatic background refresh, more than one calendar, and later,
    writing tasks back to Google Calendar
  - History and insights: streaks, a completion trend across weeks, a "best
    weekday" view (the data already exists, one doc per week)
  - Smart rollover and advanced recurrence (monthly, every N weeks)
  - Extra theme presets and custom wordmark fonts (cosmetic, almost no cost to
    build)
  - Data export (keep plain JSON export free; make PDF or printable weekly
    sheets the paid version)
- **Payments:** use Lemon Squeezy or Paddle (merchant of record: they handle
  VAT and sales tax, which matters for a solo seller) instead of raw Stripe.
- **Entitlement:** this needs the project's first server-side piece. A payment
  webhook triggers a Firebase Cloud Function that sets a `pro: true` custom
  claim, and the client reads it from the ID token. Cloud Functions require
  the **Blaze** (pay-as-you-go) plan. At this scale the bill is cents, but set
  a budget alert.

### Lower effort, lower yield

- **Tip jar / supporter badge** (Ko-fi, GitHub Sponsors): an afternoon of work,
  usually close to nothing in income. Worth adding anyway; it costs nothing.
- **Theme packs** as one-off purchases: they fit the existing theme engine,
  but income will be small on its own.

### Don't

- **Ads.** They contradict the whole design system, and with a likely
  under-18 audience they bring child-privacy compliance problems.
- **Paywalling sync or sign-in.** Cross-device sync is what makes the
  Chromebook-to-home round trip work. Locking it would kill the core loop.

### Distribution (necessary before revenue matters)

1. PWA install plus offline start (§2.2)
2. Google OAuth verification (§2.4)
3. A one-screen landing page for signed-out visitors: what it is, a
   screenshot, "start without an account"
4. A shareable read-only week view, for accountability partners or a tutor.
   It is both a feature and a growth loop.
5. Post where students and planner users already gather (r/productivity,
   r/GetStudying, r/notion-adjacent communities) with an honest "I built this"
   post. Reuse the HANDOFF design reasoning; it makes a good story.

---

## 5. A mobile app?

Verdict: yes, eventually. But build it as a thin native shell around this
same codebase, after the web version has users. Don't rewrite it.

**Where the instinct is right.** An app-store app does make paying easier.
The card is already on file, one tap with Face ID completes the purchase, and
a store listing looks more trustworthy than an unknown domain. Planners also
gain real abilities as native apps that a website can't match: **home-screen
widgets** (the single most-paid-for planner feature on phones), reliable
**reminders** (local notifications) and offline launch.

**Where it's wrong.** Being in the store doesn't bring users. Store search is
dominated by established apps with years of ratings, and with no marketing a
new planner gets close to zero downloads. People already pay subscriptions on
websites all the time (Sunsama and Notion both started web-first). What makes
people pay is trust and habit, and an app icon only partly substitutes for
either.

**What it costs:**
| | iOS (App Store) | Android (Google Play) |
| --- | --- | --- |
| Developer account | $99 / year | $25 once |
| Store cut on subscriptions | 15% (Small Business Program) | 15% |
| Before launch | Review for each release | New personal accounts need a closed test (about 12 testers for 14 days) before production |
| Must-haves | In-app purchase for digital subscriptions (US apps may also link out to web payment). **Sign in with Apple**, since Google sign-in is offered. **In-app account deletion.** | In-app account deletion; Data Safety form |

**The practical route: Capacitor.** It wraps the existing React build in a
native shell, so most of the code carries over unchanged. The known rework:
- **Sign-in.** `signInWithPopup` doesn't work inside an app webview. Switch to
  native Google sign-in and Sign in with Apple through
  `@capacitor-firebase/authentication`. The Calendar scope can be requested
  the same way.
- **Payments.** Use RevenueCat (free under $2.5k/month of revenue) on top of
  StoreKit and Play Billing, plus the web checkout from §4. That way one
  "pro" entitlement works on every platform, and nobody pays twice.
- **Native extras that justify the app.** Home-screen widget (needs some
  Swift/Kotlin code), local reminders, haptics on check-off.
- **Account deletion and JSON export (§2.3)** become mandatory, not optional.

**Recommended sequence:** PWA install first (§2.2). It costs about a day,
puts an icon on the home screen, and shows whether anyone actually keeps the
app. Then Android through Capacitor (cheap account, faster review). Then iOS,
once there is a widget worth paying for.

---

## 6. Suggested order

1. ~~Bugs 1.1 and 1.2~~ ✅
2. ~~Vitest plus tests around the sync decision table, then bugs 1.3–1.5~~ ✅
3. PWA manifest and service worker, code-splitting
4. Start Google OAuth verification (it runs in the background for weeks)
5. Undo toast, "move to next week", end-of-week carry-over
6. Account deletion and JSON export
7. Habit streaks and a cross-week history view (this becomes the core of Pro)
8. Lemon Squeezy, a Cloud Function and the `pro` claim, then launch Pro
9. Capacitor: Android first, then iOS with a widget (§5)

---

Sources consulted for §3–§4:
[Week Plan: rolling over uncompleted tasks](https://weekplan.net/features/rolling-over-uncompleted-tasks/) ·
[Week Plan support: rollover request](https://support.weekplan.net/communities/1/topics/1051-unfinished-tasks-roll-over?lang=et) ·
[ClickUp: per-list rollover request](https://feedback.clickup.com/feature-requests/p/rollover-function-for-whole-tasks-tree-for-folders-and-lists) ·
[Reddit thread snapshot on planner rollover](https://reddit.sentinel-team.org/posts/1ppxas4/snapshots/2025-12-18T22%3A00%3A21.270429Z) ·
[Tweek pricing (Toolradar)](https://toolradar.com/tools/tweek/pricing) ·
[Tweek vs TeuxDeux (Morgen)](https://morgen.so/blog-posts/tweek-vs-teuxdeux) ·
[Sunsama pricing 2026 (Morgen)](https://www.morgen.so/blog-posts/sunsama-pricing) ·
[Google: unverified apps](https://support.google.com/cloud/answer/7454865) ·
[Google: OAuth verification FAQ](https://support.google.com/cloud/answer/13463817)
