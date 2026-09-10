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

See SPEC.md §7. Implemented in Phase 2; this section will be expanded then.
