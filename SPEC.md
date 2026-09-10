# Rota — v1 Specification

**Status:** Agreed v1 scope, as built
**Product name:** Rota
**Domain:** rota.blackfamily.co.uk
**Users:** Rob and Hannah. The model supports more members, but v1 is built and tested for two.
**Deployment:** Vercel (personal account) · **Database:** Neon Postgres (personal account, separate from any Paramount Visas infrastructure)
**Timezone:** `Europe/London` · **Locale:** `en-GB`

---

## 1. What Rota is

A private household chore rota for two people. It answers four questions:

1. What needs doing?
2. When is it genuinely due?
3. Who is doing it this time?
4. What should each of us do tonight, given how much time we actually have on that weekday?

It is deliberately opinionated and deliberately small. It is not a project manager, and it must never require more admin than the chores themselves.

### Non-goals for v1

Native apps, public sign-up, multiple households, roles and permissions, gamification, comments or photos, AI scheduling, shopping or meal features, CSV import, data export, drag-and-drop, cron, preview-deployment auth, condition-based tasks, seasonal windows, minimum-gap rules, push notifications, offline mode.

---

## 2. Product principles

1. **Tonight first.** The default screen shows only what matters now.
2. **Time is the fairness unit.** Balance estimated minutes, not task count.
3. **Actual completion is authoritative.** Recurrence advances from when the work was really done.
4. **Capacity is data, not a rule.** Every member has a configurable minute budget for each of the seven weekdays. Friday to Sunday default to zero, which is what protects the weekend; nothing is hard-coded.
5. **Deterministic and explainable.** Same inputs, same plan. Every placement and every overflow has a reason code.
6. **Manual control always wins.** Move, reassign, defer, skip, complete early, or just grab something off the list on a Sunday afternoon.
7. **No invisible labour, no scoreboard.** History shows who did what without turning the house into a league table.
8. **One-handed on an iPhone.** Common actions are one tap.

---

## 3. Stack

Waypoint's scaffolding was the starting point, but Rota is maintained independently and follows current best practice where the two differ.

- Next.js 16 (App Router), React 19, TypeScript strict, pnpm
- Tailwind CSS 4, shadcn/ui on Radix primitives, lucide icons, next-themes
- Prisma 7 with the `pg` driver adapter, Neon Postgres
- **Better Auth** with the Google social provider and Prisma adapter (see §4)
- zod for validation, date-fns + date-fns-tz for dates
- Biome for lint and format
- vitest for unit tests of the pure domain modules only
- No Playwright, Sentry, Ably, analytics, or Blob storage

Layout mirrors Waypoint: top-level `app/`, `components/`, `lib/`, `prisma/`, `test/`. No `src/`.

Local development uses a Neon development branch, not Docker.

---

## 4. Authentication

### 4.1 Decision

Google sign-in through Better Auth. Reasons, for the record:

- A full-page OAuth redirect stays inside an installed iOS home-screen app; magic links do not.
- Sign in with Apple needs a paid developer membership and a client secret regenerated every six months.
- Passkeys are the best long-term Apple-household experience. Better Auth's passkey plugin is stable, so this is the intended post-v1 upgrade path.
- Auth.js v5 is still in beta; Better Auth is a stable release.

Sessions are database-backed with Better Auth's cookie cache, 30-day expiry. Better Auth stores the Google account link (provider plus subject) in its own `account` table, which replaces the original spec's `AuthIdentity`. Only the `openid email profile` scopes are requested.

### 4.2 Closed access, the simple way

There are exactly two people. One environment variable is the allowlist.

- `ROTA_ALLOWED_EMAILS` holds the two Google email addresses, comma-separated. Comparison is trimmed and lowercased.
- A Google sign-in succeeds only if the account's email is in the allowlist and Google's `email_verified` claim is true. Everyone else is refused before any user row is created.
- The first successful sign-in creates the `User` row (name and avatar from Google) and its default weekday capacities. No user seeding is needed.
- Every server action and query derives the current user from the session. Client-supplied user IDs are never authority.
- No roles. Both members can do everything.
- No credentials are stored by Rota. Google holds the password; Rota holds only the account link.
- For local development only, `ROTA_DEV_LOGIN=true` enables `/api/dev-login?email=…` with a fixed password. It is compiled out of production builds and still subject to the allowlist.

Production and local development each have their own Google redirect URI. Vercel preview deployments are not authenticated and are not a supported target; deploy from `main`.

---

## 5. Domain model

UUIDs throughout. Timestamps stored in UTC; calendar dates (plan days, week starts, overrides) stored as dates. Conversion to `Europe/London` happens only in the domain and view layers. Weekdays use ISO numbering, Monday = 1 to Sunday = 7.

### Household
One row. `name`, `timezone`, `locale`, `dueSoonDaysDefault` (default 7).

### User
Better Auth's user table plus `active`. Every active user is a household member.

### WeekdayCapacity
`userId`, `weekday` (1–7), `minutes`. Unique on `(userId, weekday)`. Seeded 30/30/30/20/0/0/0 and editable in Settings.

### CapacityOverride
`userId`, `localDate`, `minutes`, `note`. Unique on `(userId, localDate)`. Zero minutes means unavailable. Covers "out Tuesday" and "only 15 minutes tonight".

### Area
`name`, `icon` (known key set), `colour` (known token set), `sortOrder`, `active`. Seed: Kitchen, Lounge, Hall & Stairs, Main Bedroom, Other Bedrooms, Bathrooms, Office, Utility & Appliances, Whole House, Outside.

### Task
- `areaId`, `name`, `notes` (plain text, shown on expand)
- `estimatedMinutes` (1–180), `priority` `LOW | NORMAL | HIGH | ESSENTIAL` (default NORMAL)
- `unpleasant` boolean. Drives the "not a dirty job" filter and the heavy-task spreading rule.
- `taskType` `RECURRING | ONE_OFF`
- `assignmentMode` `FIXED | ALTERNATE | BALANCED` (default BALANCED), `fixedAssigneeId` required when FIXED
- `recurrenceValue`, `recurrenceUnit` `DAY | WEEK | MONTH | YEAR`, `recurrenceAnchor` `COMPLETION | SCHEDULE` (default COMPLETION). Required only for RECURRING.
- `dueSoonDays` nullable, falls back to the household default
- `preferredWeekday` nullable, `allowedWeekdays` (default all seven; the planner intersects this with days that have capacity)
- `lastCompletedAt`, `nextDueAt` (denormalised caches, recomputed transactionally)
- `deferredUntil` nullable
- `pausedAt` nullable. A paused task is switched off indefinitely: it never enters plans or Pick and never shows as overdue, but it keeps its history and settings. Lawn mowing in December.
- `archivedAt` nullable; archived tasks stay in history but never enter plans

### TaskCompletion
The authoritative history. `taskId`, `completedById`, `completedAt`, `plannedTaskId` nullable, `actualMinutes` nullable, `note`, `source` `PLAN | PICK | MANUAL`, `voidedAt`, `voidedById`, `voidReason`. Never hard-deleted; mistakes are voided and task state recomputed.

### WeeklyPlan
`weekStartDate` (local Monday, unique), `generatedAt`, `algorithmVersion`, `inputSnapshot` JSON (capacities, overrides, weights). No draft/published lifecycle; a plan exists or it doesn't.

### PlannedTask
`weeklyPlanId`, `taskId`, `plannedDate` nullable, `assignedToId` nullable, snapshots of `estimatedMinutes`, `priority`, `dueAt`, `score`, `explanationCode`, `sortOrder`, `state` `PLANNED | COMPLETED | SKIPPED | REMOVED | UNSCHEDULED`, `completionId`, `manualOverride`.

Overflow is represented as `UNSCHEDULED` rows with a reason code, so one table holds the whole plan.

---

## 6. Recurrence semantics

Implemented as a pure, table-tested module. No date arithmetic in components or route handlers.

- **Completion-anchored (default):** next due = latest valid completion + interval. Month and year steps clamp to the last valid day (31 Jan + 1 month = 28/29 Feb).
- **Schedule-anchored:** advance from the previous due date by whole intervals until the result is after the latest completion. Stable cadence without drift or an instantly overdue duplicate.
- **New tasks** need either a "last done" date or a "first due" date. The form makes staggering easy and never defaults everything to today.
- **Complete early** (from Pick or the catalogue): a normal completion with source `PICK`; recurrence advances from it.
- **Defer:** sets `deferredUntil`. Eligibility changes, recurrence does not. Cleared on completion.
- **Skip this occurrence:** marks the plan item skipped and advances recurrence once from `nextDueAt`. Requires confirmation. Creates no completion.
- **Remove from plan:** drops this week's placement only; the task stays due.
- **Pause:** sets `pausedAt`. Recurrence does not advance and nothing accrues as overdue. **Resume** clears it; if `nextDueAt` is now in the past it is set to today, so a resumed task is simply due rather than months overdue. The user can edit the date afterwards.
- **One-off tasks** archive themselves on completion.

Due states: Not due · Due soon · Due · Overdue · Deferred · Paused.

---

## 7. Weekly planner

A pure service: inputs in, plan out, persist after validation. Algorithm version string starts at `v1`. Generated lazily the first time anyone opens the app in a new week, or on demand from the Week screen.

### 7.1 Window and buckets
The week runs Monday to Sunday in `Europe/London`. A bucket is one member on one date, with capacity = weekday capacity unless a `CapacityOverride` exists. Buckets with zero capacity are never used. With the default seed that means nothing lands on Friday to Sunday.

### 7.2 Candidates
Active, unarchived, unpaused tasks that are overdue, due on or before the end of the week, or manually added, excluding tasks deferred beyond the week end and tasks already placed. Tasks inside their due-soon window may be pulled forward only into genuinely spare capacity; never fill for the sake of filling.

### 7.3 Score
```
score = priorityWeight (LOW 100, NORMAL 300, HIGH 600, ESSENTIAL 1000)
      + overdueDays * 20
      + max(0, dueSoonDays - daysUntilDue) * 5
      + manualPin ? 10000 : 0
```
Sort by score desc, due date asc, minutes desc, task ID. Constants live in one versioned config module with tests. Weights are a starting point and are expected to be tuned after real use.

### 7.4 Assignment
- `FIXED`: the configured member only.
- `ALTERNATE`: whoever did not do it last; with no history, the lower projected load.
- `BALANCED`: the member with the lowest projected load.

```
projectedLoad = plannedMinutesThisWeek + completedMinutesInPrevious28Days * 0.25
```

### 7.5 Placement
For each candidate in score order: enumerate eligible buckets (allowed weekday, capacity remaining, on or before due date where possible), prefer the preferred weekday if it fits, then choose the bucket with the lowest utilisation ratio. Avoid giving one person two heavy tasks (30+ minutes, ESSENTIAL, or unpleasant) on the same night. ESSENTIAL tasks may overflow a bucket; anything else that does not fit becomes `UNSCHEDULED` with a reason: insufficient capacity, assignee unavailable, no allowed day, fixed assignee overloaded, or task longer than any bucket.

### 7.6 Regeneration
Preserves completed, skipped, and removed items and anything with `manualOverride`. Re-plans only the rest plus newly eligible candidates. No preview step in v1.

Regeneration happens automatically after any task change, completion, void, or capacity override, and on demand from the Week screen, so the plan never drifts from the task list. Only weeks from the current one onwards are touched.

### 7.7 Idempotency
Plan creation is idempotent on `weekStartDate` inside a transaction. Completing a planned item twice yields one completion. `lastCompletedAt` and `nextDueAt` are recomputed in the same transaction as any history change.

---

## 8. Screens

Mobile bottom navigation: **Tonight · Week · Tasks · Pick · More** (More: Areas, History, Settings, Sign out). Desktop uses a sidebar with the same routes. Server components by default; client components only where interaction demands it.

```
/              Tonight
/week          current week, /week/[weekStart] for others
/tasks         catalogue, /tasks/new, /tasks/[id], /tasks/[id]/edit
/pick          "What can I do?"
/areas
/history
/settings
/sign-in
```

### Tonight
Today's local date, each member's list with combined minutes and progress, compact cards (area, name, minutes, due state), one-tap complete with optimistic update and rollback on failure, expand for notes, reassign, move, defer, skip. When nothing is planned (typically a weekend) show a calm empty state with a link to Pick.

### Week
One column per day that has any capacity, stacked on mobile. Per-person and total minutes, capacity warnings, an overflow section with reasons and actions (add anyway, defer, change duration, change days), regenerate button. Move and reassign use accessible controls.

### Tasks
Search and filter by area, assignee, type, due state, paused, archived. Create, edit, duplicate, pause, resume, archive, restore. Shows last done, next due, cadence, minutes, assignment. Actions: complete now, defer, pause, view history.

### Task form
Progressive disclosure. First screen: name, area, minutes, type, recurrence, assignment, last done or first due. Advanced: priority, unpleasant, due-soon window, preferred and allowed days, anchor, notes. Live plain-English preview: "Every 6 weeks, next due Thursday 22 October".

### Pick
For "it's Sunday, I'm bored, what have you got?" Lists tasks grouped Overdue → Due → Due soon → Not due yet (collapsed). Filters: quick (15 minutes or less), not unpleasant, area, not assigned to the other person. Completing here records a `PICK` completion, or completes the plan item if the task is in this week's plan. Works on any day.

### History
Chronological completions, filterable by task, area, member, date range. Estimated versus actual minutes. Void with a reason; voiding recomputes recurrence and updates the current plan.

### Settings
Household name; per-member per-weekday capacity grid; members list; theme follows system.

---

## 9. Design and PWA

Calm, domestic, warm neutrals, restrained area colours. Light and dark from system preference. 44px touch targets, visible focus, WCAG AA contrast, due state never by colour alone, reduced-motion respected, UK dates, plain English ("3 days overdue", "Couldn't fit this week"). Confirm skip, archive, and void.

Installable on iOS, iPadOS, and macOS: web app manifest (standalone), proper icons and `apple-touch-icon`, safe-area insets under the bottom nav, no hover-only interactions, sign-in verified to return into the installed app. A dismissible "Add to Home Screen" hint appears after the first successful use, not on first visit.

---

## 10. Dates and time

Instants in UTC, calendar dates as dates, all boundaries in `Europe/London`. Unit tests cover GMT and BST, both DST transitions, leap years, month ends, and year boundaries. The browser's timezone is never authoritative.

---

## 11. Security

Deny by default, allowlist by database, session-derived user on every mutation, standard security headers and a CSP compatible with Google sign-in, notes rendered as text, no secrets or tokens in logs, no analytics or tracking.

---

## 12. Environment

```
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ROTA_ALLOWED_EMAILS=    # the allowlist: "rob@example.com,hannah@example.com"
```

`.env.example` ships with placeholders. Exact variable names follow Better Auth's current documentation.

---

## 13. Seed

Idempotent. Creates the household and the default areas. Users and their default capacities are created on first sign-in. Tasks are entered through the UI; the task form's "last done" field handles staggering.

---

## 14. Testing

Unit tests (vitest, table-driven) for recurrence, due-state classification, candidate selection, scoring and tie-breaking, each assignment mode, capacity allocation, heavy-task spreading, overflow reasons, regeneration preservation, and DST edges. The planner and recurrence modules must run without a database or React.

No end-to-end suite. UI is verified by driving the running app in the browser during development. Quality gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

---

## 15. Phases

**0 — Foundation.** Repo, tooling, Prisma + Neon, Better Auth + Google + email allowlist, seed, layout and navigation, design tokens. Exit: both accounts sign in on iPhone from the installed PWA and a third Google account is refused.

**1 — Tasks.** Areas, task CRUD, recurrence engine, completions, complete-now, defer, skip, archive, void. Tasks and History screens. Exit: mixed-cadence tasks tracked correctly without a planner.

**2 — Planner.** Capacities and overrides, scoring, assignment, placement, Week and Tonight, overflow, manual adjustments, regeneration. Exit: a real week is generated, explained, adjusted, and completed.

**3 — Polish.** Pick screen, PWA assets and iOS install flow, security headers, accessibility pass, docs, production setup checklist. Exit: acceptance scenarios pass.

### Post-v1 candidates
Passkeys, Sign in with Apple, web push, offline completion queue, holiday mode, a third member, condition-based tasks, seasonal windows, data export, Home Assistant.

---

## 16. Acceptance scenarios

- **Mixed cadence.** Weekly dusting, four-weekly sofa vacuum, six-weekly filters, quarterly windows: the week contains only what is due or reasonably soon, and each completion yields the right next date.
- **Weekend by default.** With default capacities, a task due Saturday is pulled into Monday to Thursday and nothing is placed Friday to Sunday. Giving Saturday 60 minutes in Settings allows Saturday placement.
- **Balanced pair.** Both free for 30 minutes; two 15-minute tasks and one 30-minute task split by minutes, not count. Fixed and alternate rules hold.
- **Changed availability.** Hannah unavailable Tuesday: regeneration moves only unaffected work and never gives her Tuesday.
- **Late completion.** A four-week task done five days late is next due four weeks from the actual completion.
- **Skip is not completion.** Defer leaves recurrence alone; skip advances it with confirmation; neither writes history.
- **Closed door.** Rob and Hannah sign in; any other Google account is refused and sees no data.
- **Paused in winter.** Lawn mowing paused in December generates nothing and shows no overdue count. Resumed in March it is due once, not twelve times.
- **Corrected history.** Voiding a completion keeps the audit trail, recomputes due state, and updates the current plan.
- **Overflow is visible.** Excess work appears in "Couldn't fit this week" with reasons, never silently dropped or pushed to a zero-capacity day.
- **Sunday afternoon.** Pick shows something quick and not unpleasant; completing it records history and advances recurrence.
- **Mobile.** On an iPhone viewport: sign in, see tonight, read notes, reassign, complete, confirm, with no horizontal scrolling.

---

## 17. Documentation

`README.md` (purpose, stack, setup, commands), `docs/domain.md` (recurrence, skip, defer, planning), `docs/setup.md` (Google console, Neon, Vercel, seed, production checklist), `.env.example`.
