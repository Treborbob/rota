/**
 * Moves planned-but-undone items whose evening has passed onto their
 * owner's next evening (rules in lib/domain/carry-over). Runs whenever the
 * current week is read, so the day after a missed evening simply opens with
 * the leftovers on it. Idempotent: once moved, nothing is dated in the past.
 */
import { fromDbDate, type LocalDate, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { carryOver } from "@/lib/domain/carry-over";
import { listMembers } from "@/lib/members";
import { loadCapacityCells, toBuckets } from "@/lib/planning/capacity";

export async function carryOverMissed(
  planId: string,
  weekStart: LocalDate,
  today: LocalDate,
): Promise<void> {
  const missed = await db.plannedTask.findMany({
    where: {
      weeklyPlanId: planId,
      state: "PLANNED",
      plannedDate: { lt: toDbDate(today) },
      assignedToId: { not: null },
    },
    select: { id: true, assignedToId: true, plannedDate: true },
  });
  if (missed.length === 0) return;

  const members = await listMembers();
  const cells = await loadCapacityCells(
    weekStart,
    members.map((m) => m.id),
  );
  const moves = carryOver(
    missed.map((m) => ({
      id: m.id,
      // Both non-null by the query above; narrowed for the types.
      userId: m.assignedToId as string,
      date: fromDbDate(m.plannedDate as Date),
    })),
    { weekStart, today, buckets: toBuckets(cells) },
  );

  await db.$transaction(
    moves.map((move) =>
      // Guarded on the old date so two phones opening at once move it once.
      db.plannedTask.updateMany({
        where: {
          id: move.id,
          state: "PLANNED",
          plannedDate: { lt: toDbDate(today) },
        },
        data: move.date
          ? {
              plannedDate: toDbDate(move.date),
              manualOverride: true,
              explanationCode: "CARRIED_OVER",
              startedAt: null,
            }
          : {
              plannedDate: null,
              assignedToId: null,
              state: "UNSCHEDULED",
              manualOverride: false,
              explanationCode: "MISSED_NO_EVENING_LEFT",
              startedAt: null,
            },
      }),
    ),
  );

  console.info(
    `[carry-over] week=${weekStart} today=${today} moved=${moves.filter((m) => m.date).length} stranded=${moves.filter((m) => !m.date).length}`,
  );
}
