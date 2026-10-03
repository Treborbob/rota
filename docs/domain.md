# Domain rules

How Rota decides what is due, what happens when something is done, and how
the week is planned. The code for all of this lives in `lib/domain/` (pure,
unit tested) and `lib/tasks/complete.ts` (the two transactions that touch
history).

## Dates

Instants (when something happened) are stored in UTC. Calendar dates (when
something is due, which day it is planned for) are stored as dates and travel
through the code as `"yyyy-MM-dd"` strings. All conversion between the two
happens in `lib/dates.ts` in `Europe/London`. Nothing else may reason about
timezones.

## Due state

For a task with a next due date, given today's local date and the task's
"due soon" window (default 7 days, from household settings):

| State | Meaning |
| --- | --- |
| Paused | Switched off indefinitely. Never planned, never overdue. |
| Deferred | `deferredUntil` is after today. Hidden from plans until then. |
| Whenever | A one-off with no date. |
| Not due | More than the due-soon window away. |
| Due soon | Inside the window. |
| Due | Today. |
| Overdue | Before today. Shown as "N days overdue". |

Paused beats deferred beats everything else. An expired deferral is ignored.

## Recurrence

Recurring tasks have an interval (`value` × `DAY | WEEK | MONTH | YEAR`) and an
anchor.

**Completion-anchored (default).** Next due = the day it was actually done +
one interval. Doing a four-weekly job five days late makes it due four weeks
after the late day, not four weeks after the old due date.

**Schedule-anchored.** The cadence is fixed to the calendar. From the previous
due date, step forward by whole intervals until the result is after the
completion day. Done late: the schedule doesn't drift. Done very late: missed
occurrences are dropped rather than stacked up. Done early: the next slot
stands. With no previous due date it behaves like completion-anchored.

Month and year arithmetic clamps to the last valid day: 31 January + 1 month is
28 (or 29) February; 29 February + 1 year is 28 February.

**New tasks** start from either a "last done" date (next due is computed from
it) or a "first due" date. One-offs may also have no date at all.

## Doing a task

`recordCompletion` runs in one transaction:

1. Write a `TaskCompletion` (who, when, actual minutes, note, source). It
   snapshots the task's `nextDueOn` and `lastCompletedAt` as they were.
2. Advance `nextDueOn` per the recurrence rules above. One-offs archive.
3. Set `lastCompletedAt`, clear any deferral.
4. If the task has a planned item in the `PLANNED` state, mark it `COMPLETED`.

Sources: `MANUAL` (from the catalogue or detail page), `PICK` (from the Pick
screen), `PLAN` (from Tonight or the Week view).

Back-dated completions land at midday local time on the chosen day, so they
sort sensibly and sit on the right calendar day either side of a DST switch.

### Where a completion lands in the plan

If the task has a placement in a plan: done on the planned day, the item is
marked complete; done on another day of the same week, the item moves to that
day so the week shows the work where it happened; done outside that week (an
early completion from Pick, say), the placement is deleted. The task is not
re-planned because its next due date has moved on.

## How long things really take

A completion may carry `actualMinutes`. Three ways it gets there: the
completion dialog (Pick, task page) asks; a running timer on a plan item
(Start, then Done) records the elapsed minutes; and after a one-tap Done the
card offers "took about N min?" with nudges. None of it is mandatory.

Once a task has at least 3 recorded durations (looking at the last 10), the
**typical** figure, the median, replaces the estimate for planning. The task
page shows the range and offers to adopt the typical figure as the estimate.
The plan snapshot stores the minutes the planner actually used. See
`lib/domain/duration.ts`.

## Undoing (voiding) a completion

Completions are never deleted. Voiding marks the row with who, when and why,
and it stays visible in history struck through.

If the voided row was the task's newest valid completion, the task's
`nextDueOn` and `lastCompletedAt` are restored from the snapshots on that row.
If a newer valid completion exists, the task is left alone: the newer one
already governs its state. A one-off archived by the voided completion is
un-archived. A plan item linked to the completion returns to `PLANNED`.

## Defer, skip, pause, archive

| Action | Effect on recurrence | Effect on history | Undo |
| --- | --- | --- | --- |
| Defer until date | None | None | "Undo defer" |
| Skip this time | `nextDueOn` advances one interval from where it was | None | Edit the date |
| Pause | None; frozen | None | Resume (if the date is now in the past it becomes today) |
| Archive | None | Kept | Restore |

Skip asks for confirmation because it asserts the current cycle is
intentionally being missed. Archiving or skipping a task also marks its
`PLANNED` items `REMOVED` or `SKIPPED` respectively.

## Planning

Implemented in `lib/domain/planner.ts` (pure) and `lib/planning/` (database
in, database out). Numbers live in `lib/domain/planner-config.ts` under
`ALGORITHM_VERSION`; every plan records the version and inputs it was built
with.

### Capacity

Each member has a minute budget per ISO weekday (Settings), and any single
date can be overridden ("out Tuesday", "only 15 minutes tonight"). An
override of 0 minutes means away; Settings can set one over a range of days
for a holiday. A slot is
one member on one date with more than zero minutes, on or after today. There
is no weekend rule: Friday to Sunday simply default to zero.

### Candidates

Active, unpaused tasks that are overdue, due on or before the Sunday of the
week, or added to the week by hand ("pinned"). A deferral hides a task unless
it is pinned. Undated one-offs are never planned; they live in Pick.

Nothing due after the week is pulled forward, however much time is spare. A
cadence is a deliberate choice (a two-monthly dishwasher clean costs money and
gains nothing done early) and the planner cannot see the reasons behind it.
Someone with a free evening uses Pick, or "Add a task" on the Week screen to
pin a specific job into the week. Plans made before `v2` may still carry the
`PULLED_FORWARD` code.

### Score and order

```
score = priority (LOW 100, NORMAL 300, HIGH 600, ESSENTIAL 1000)
      + days overdue × 20
      + max(0, dueSoonDays − daysUntilDue) × 5
      + 10 000 if pinned
```

Sorted by score, then due date, then estimated minutes (longest first), then
task id. Same inputs always give the same plan.

### Who

- **Fixed**: that person only.
- **Take turns**: whoever did not do it last; with no history, the lighter load.
- **Whoever's free**: anyone.

Load = minutes already placed this week + 25% of minutes completed in the
previous 28 days. It is a tie-breaker, not the main lever, so the current
week stays legible.

### Where

A task goes on its due day, or the nearest evening after it. Never earlier:
a cadence is deliberate, doing a job early wastes the effort, and because
most tasks re-anchor to the day they were done, an early placement shifts
every later occurrence too. (The old "on or before the due date, emptiest
evening" rule ratcheted every weekly job towards Monday.) Overdue work
therefore lands on the first evening from today, and a task added to the
week by hand may go anywhere in it. Within those evenings a task's preferred
weekday wins outright when it has room, because a person chose it; it never
pulls a task earlier than its due date. (Before `v5` it did, so a weekly job
preferring Monday that was done on a Saturday came back two days later.)

For each candidate in order, the eligible slots (the person or people it may
go to, on an allowed weekday, on or after the due date) are sorted by date,
then by projected utilisation (used + task) ÷ capacity plus a penalty if the
slot already holds a heavy job (30+ minutes, essential, or unpleasant), then
lighter recent load, then member order. So load balancing and heavy-job
spreading only decide between people on the same evening; they never move a
task to a different day. The task must fit; only an ESSENTIAL task may
overflow a slot rather than be dropped.

A task due after the last evening with any time (a Saturday job in a
household that does nothing at weekends) is not placed this week. It is
reported as `DUE_AFTER_LAST_EVENING` and shown under "Waiting for next
week"; the following week it is overdue and lands on the first evening.
Once done there it re-anchors to that weekday and settles.

### Overflow reasons

| Code | Meaning |
| --- | --- |
| NO_CAPACITY | Nothing left this week |
| ASSIGNEE_UNAVAILABLE | The fixed person has no slots at all |
| NO_ALLOWED_DAY | None of its allowed days have time |
| FIXED_ASSIGNEE_OVERLOADED | The fixed person's slots are full |
| TOO_LONG_FOR_ANY_SLOT | Longer than any single evening |
| MISSED_NO_EVENING_LEFT | Before `v4`: missed earlier in the week, owner had no evening left |
| DUE_AFTER_LAST_EVENING | Due after the last evening with time; waits for next week, not a shortfall |

Every reason except `DUE_AFTER_LAST_EVENING` is a **shortfall**: more minutes
in an evening would fix it. The Week and Tonight screens sum those minutes
("About 1 h 10 more than the week has room for") and, when the whole
shortfall is one person's fixed jobs and someone else has spare time, say
who and when.

### Carry-over and pushing

A planned item that was not done by the end of its day is a debt, and debt
has an owner. Whenever a current or future week is read, every item still
in the `PLANNED` state and dated before today, in any week, moves to today.
"Push to tomorrow" on one of tonight's items does the same thing on
purpose: it moves to tomorrow. Either way the item stays with its owner,
whatever the task's assignment mode says, and lands on top of that day's
existing plan: nothing else moves, and the day simply runs over budget,
shown as "60/40 min · includes 20 min carried over". The item is pinned
there like a hand-moved one, so later regeneration leaves it alone, and it
does not use up the day's minutes when the planner runs, so the day's
normal work is not pushed off it. Missing or pushing it again stacks it
onto the following day. Skip, Defer or Not this week are the ways to shed
it.

Capacity does not matter to where it lands. Thursday's leftovers are
Friday's, even with no minutes budgeted, and Sunday's are next Monday's: if
the week got away from you, the weekend is where it has to be done. The
only days it skips are ones its owner is **away**, meaning an override of 0
minutes (a single "out Tuesday", or a holiday set over a range in
Settings). An item already carried onto a day its owner is later marked
away moves on to the next day they aren't.

Arriving in another week, the item joins that week's plan and replaces
whatever the planner had put there for the task, and that week is re-planned
around it. If that week has already settled the task (done, skipped, taken
off or placed by hand) the leftover is dropped instead. While an item sits
in a later week, earlier weeks don't plan the task again.

A leftover whose task has moved on since it was planned is dropped rather
than carried: its due date changed (done or skipped some other way, or
edited), or the task is archived, paused or deferred past today. The
following week's normal planning picks up anything still due.

Rules in `lib/domain/carry-over.ts`. Plans before `v4` stranded leftovers
with no evening left in the week as `MISSED_NO_EVENING_LEFT`; that code is
no longer produced.

### Regeneration

A plan is created lazily the first time anyone opens the week, and
regenerated whenever a task changes, a completion is recorded or voided, an
override is set, or someone taps Re-plan. Regeneration keeps completed items,
hand-moved items (`manualOverride`), skips and removals exactly where they
are and plans everything else around them. Adding a task by hand pins it;
pins are remembered in the plan's snapshot.
