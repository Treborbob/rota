/**
 * Carry-over: work that was planned, not done, and whose evening has passed.
 *
 * Without the app you would do yesterday's leftovers today, on top of
 * today's jobs, and accept the longer evening. This mirrors that. Each missed
 * item moves to its owner's next evening with any minutes at all, stays with
 * that owner whatever the task's assignment mode says, and sits on top of
 * the day's budget rather than pushing anything else off it. Pure: no
 * database, no clock.
 */
import { addDaysLocal, type LocalDate } from "@/lib/dates";
import type { PlannerBucket } from "@/lib/domain/planner";

export type MissedItem = {
  id: string;
  userId: string;
  date: LocalDate;
};

export type CarryOver = {
  id: string;
  /** Where it lands, or null when the owner has no evening left this week. */
  date: LocalDate | null;
};

/**
 * Decide where each missed item goes. Items dated today or later are not
 * missed and are left out of the result. Same inputs, same answer.
 */
export function carryOver(
  items: MissedItem[],
  input: { weekStart: LocalDate; today: LocalDate; buckets: PlannerBucket[] },
): CarryOver[] {
  const weekEnd = addDaysLocal(input.weekStart, 6);
  const nextEvening = new Map<string, LocalDate | null>();

  const nextEveningFor = (userId: string): LocalDate | null => {
    const cached = nextEvening.get(userId);
    if (cached !== undefined) return cached;
    const dates = input.buckets
      .filter(
        (b) =>
          b.userId === userId &&
          b.minutes > 0 &&
          b.date >= input.today &&
          b.date <= weekEnd,
      )
      .map((b) => b.date)
      .sort();
    const found = dates[0] ?? null;
    nextEvening.set(userId, found);
    return found;
  };

  return items
    .filter((item) => item.date < input.today)
    .map((item) => ({ id: item.id, date: nextEveningFor(item.userId) }));
}
