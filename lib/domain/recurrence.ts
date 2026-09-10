/**
 * Recurrence arithmetic. Pure: local dates in, local dates out. No database,
 * no React, no timezone — a LocalDate is already a household-local calendar day.
 */
import {
  addDaysLocal,
  addMonthsLocal,
  addWeeksLocal,
  addYearsLocal,
  type LocalDate,
} from "@/lib/dates";

export type RecurrenceUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";
export type RecurrenceAnchor = "COMPLETION" | "SCHEDULE";

export type Recurrence = {
  value: number;
  unit: RecurrenceUnit;
  anchor: RecurrenceAnchor;
};

/** Advance a date by `n` intervals (n may be negative). */
export function addInterval(
  date: LocalDate,
  recurrence: Pick<Recurrence, "value" | "unit">,
  n = 1,
): LocalDate {
  const steps = recurrence.value * n;
  switch (recurrence.unit) {
    case "DAY":
      return addDaysLocal(date, steps);
    case "WEEK":
      return addWeeksLocal(date, steps);
    case "MONTH":
      return addMonthsLocal(date, steps);
    case "YEAR":
      return addYearsLocal(date, steps);
  }
}

/**
 * The next due date after a completion.
 *
 * COMPLETION anchor: one interval after the day the work was done. A task
 * finished five days late is next due a full interval after that late day.
 *
 * SCHEDULE anchor: keep the original cadence. Step forward from the previous
 * due date by whole intervals until the result is after the completion day,
 * so a late completion neither drifts the schedule nor leaves a second,
 * instantly overdue occurrence. With no previous due date, fall back to the
 * completion anchor.
 */
export function nextDueAfterCompletion(params: {
  recurrence: Recurrence;
  previousDueOn: LocalDate | null;
  completedOn: LocalDate;
}): LocalDate {
  const { recurrence, previousDueOn, completedOn } = params;

  if (recurrence.anchor === "COMPLETION" || previousDueOn === null) {
    return addInterval(completedOn, recurrence);
  }

  let next = addInterval(previousDueOn, recurrence);
  // Guard against a zero-progress interval; value is validated positive but
  // a runaway loop here would be catastrophic, so cap it.
  let guard = 0;
  while (next <= completedOn && guard < 10_000) {
    next = addInterval(next, recurrence);
    guard += 1;
  }
  return next;
}

/**
 * Skipping the current occurrence: the cycle moves on once from where it was
 * due, without any completion being recorded.
 */
export function nextDueAfterSkip(params: {
  recurrence: Recurrence;
  currentDueOn: LocalDate;
}): LocalDate {
  return addInterval(params.currentDueOn, params.recurrence);
}

/** Initial due date for a task created with a "last done" date. */
export function initialDueFromLastDone(params: {
  recurrence: Recurrence;
  lastDoneOn: LocalDate;
}): LocalDate {
  return addInterval(params.lastDoneOn, params.recurrence);
}

/** "Every 6 weeks", "Every month", "Every 2 years", "Daily". */
export function describeCadence(
  recurrence: Pick<Recurrence, "value" | "unit">,
): string {
  const { value, unit } = recurrence;
  const noun = { DAY: "day", WEEK: "week", MONTH: "month", YEAR: "year" }[unit];
  if (value === 1) {
    return unit === "DAY" ? "Daily" : `Every ${noun}`;
  }
  return `Every ${value} ${noun}s`;
}
