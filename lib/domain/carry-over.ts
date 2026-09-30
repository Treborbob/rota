/**
 * Carry-over: work that was planned and not done, or put off on purpose.
 *
 * Without the app you would do yesterday's leftovers today, on top of
 * today's jobs, and accept the longer day. This mirrors that. A missed item
 * lands on today; a pushed one on tomorrow. Either way it stays with its
 * owner, sits on top of that day's budget rather than pushing anything else
 * off it, and ignores weekends and week boundaries: if the week got away
 * from you, Friday or next Monday is where it has to be done. The only days
 * it skips are ones its owner is marked away (an override of 0 minutes).
 * Pure: no database, no clock.
 */
import { addDaysLocal, type LocalDate, maxLocalDate } from "@/lib/dates";

/** A day someone is marked away: an explicit override of 0 minutes. */
export type AwayDay = { userId: string; date: LocalDate };

export type CarryItem = {
  id: string;
  userId: string;
  date: LocalDate;
  /** Already carried or pushed, so it follows the owner off an away day. */
  carried: boolean;
  /** The task's due date when the item was planned. */
  dueOnSnapshot: LocalDate | null;
  task: {
    nextDueOn: LocalDate | null;
    archived: boolean;
    paused: boolean;
    deferredUntil: LocalDate | null;
  };
};

export type CarryOver = {
  id: string;
  /** Where it lands, or null when the task no longer owes it. */
  date: LocalDate | null;
};

/** The first day on or after `from` that the person isn't marked away. */
function nextDayNotAway(
  userId: string,
  from: LocalDate,
  away: AwayDay[],
): LocalDate {
  const mine = new Set(
    away.filter((a) => a.userId === userId).map((a) => a.date),
  );
  let date = from;
  while (mine.has(date)) date = addDaysLocal(date, 1);
  return date;
}

/** Where "push to tomorrow" puts a job its owner can't face today. */
export function pushTarget(
  userId: string,
  today: LocalDate,
  away: AwayDay[],
): LocalDate {
  return nextDayNotAway(userId, addDaysLocal(today, 1), away);
}

/**
 * Whether the task still owes this item. Done, skipped or re-dated since it
 * was planned (its due date moved), archived, paused or deferred: the item
 * is stale and is dropped rather than carried.
 */
function stillOwed(item: CarryItem, today: LocalDate): boolean {
  const { task } = item;
  if (task.archived || task.paused) return false;
  if (task.deferredUntil && task.deferredUntil > today) return false;
  return task.nextDueOn === item.dueOnSnapshot;
}

/**
 * Decide which items move and where. An item moves when its day has passed,
 * or when it was already carried and its owner is now away that day. Items
 * that stay put are left out of the result. Same inputs, same answer.
 */
export function carryOver(
  items: CarryItem[],
  input: { today: LocalDate; away: AwayDay[] },
): CarryOver[] {
  const { today, away } = input;
  const isAway = (userId: string, date: LocalDate) =>
    away.some((a) => a.userId === userId && a.date === date);

  return items
    .filter(
      (item) =>
        item.date < today || (item.carried && isAway(item.userId, item.date)),
    )
    .map((item) => ({
      id: item.id,
      date: stillOwed(item, today)
        ? nextDayNotAway(item.userId, maxLocalDate(item.date, today), away)
        : null,
    }));
}
