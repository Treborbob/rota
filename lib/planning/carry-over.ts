/**
 * Applies the carry-over rules (lib/domain/carry-over) to the database.
 * carryOverMissed runs whenever a current or future week is read, so the
 * day after a missed evening simply opens with the leftovers on it, and a
 * carried job on a day someone has since marked away moves off it.
 * moveCarried is shared with "push to tomorrow". Both are idempotent.
 */
import {
  fromDbDate,
  type LocalDate,
  startOfWeekLocal,
  toDbDate,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { carryOver } from "@/lib/domain/carry-over";
import type { Prisma } from "@/lib/generated/prisma/client";
import { loadAwayDays } from "@/lib/planning/capacity";
import { ensurePlan, generatePlan } from "@/lib/planning/generate";

type Tx = Prisma.TransactionClient;

export type CarryMove = {
  id: string;
  taskId: string;
  /** The item's current date; the move only happens if it still has it. */
  from: LocalDate;
  /** Where it lands, or null to drop a stale item. */
  to: LocalDate | null;
};

export async function carryOverMissed(today: LocalDate): Promise<void> {
  const rows = await db.plannedTask.findMany({
    where: {
      state: "PLANNED",
      assignedToId: { not: null },
      OR: [
        { plannedDate: { lt: toDbDate(today) } },
        {
          explanationCode: "CARRIED_OVER",
          plannedDate: { gte: toDbDate(today) },
        },
      ],
    },
    select: {
      id: true,
      taskId: true,
      assignedToId: true,
      plannedDate: true,
      explanationCode: true,
      dueOnSnapshot: true,
      task: {
        select: {
          nextDueOn: true,
          archivedAt: true,
          pausedAt: true,
          deferredUntil: true,
        },
      },
    },
  });
  if (rows.length === 0) return;

  const items = rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    // Both non-null by the query above; narrowed for the types.
    userId: r.assignedToId as string,
    date: fromDbDate(r.plannedDate as Date),
    carried: r.explanationCode === "CARRIED_OVER",
    dueOnSnapshot: fromDbDate(r.dueOnSnapshot),
    task: {
      nextDueOn: fromDbDate(r.task.nextDueOn),
      archived: r.task.archivedAt !== null,
      paused: r.task.pausedAt !== null,
      deferredUntil: fromDbDate(r.task.deferredUntil),
    },
  }));
  const away = await loadAwayDays(
    [...new Set(items.map((i) => i.userId))],
    today,
  );
  const decisions = carryOver(items, { today, away });
  if (decisions.length === 0) return;

  const byId = new Map(items.map((i) => [i.id, i]));
  await moveCarried(
    decisions.map((d) => {
      const { taskId, date } = byId.get(d.id) as (typeof items)[number];
      return { id: d.id, taskId, from: date, to: d.date };
    }),
  );

  console.info(
    `[carry-over] today=${today} moved=${decisions.filter((d) => d.date).length} dropped=${decisions.filter((d) => !d.date).length}`,
  );
}

/**
 * Put each item on its new day as carried over: pinned against regeneration
 * and on top of that day's budget. An item landing in another week joins
 * that week's plan, which is then re-planned around it.
 */
export async function moveCarried(moves: CarryMove[]): Promise<void> {
  const replan = new Set<LocalDate>();
  for (const move of moves) {
    const week = await db.$transaction((tx) => applyMove(tx, move));
    if (week) replan.add(week);
  }
  for (const week of replan) await generatePlan(week);
}

/** Returns the week to re-plan, if the move changed another week's plan. */
async function applyMove(tx: Tx, move: CarryMove): Promise<LocalDate | null> {
  // Guarded on the old date so two phones opening at once move it once.
  const guard = {
    id: move.id,
    state: "PLANNED" as const,
    plannedDate: toDbDate(move.from),
  };
  if (!move.to) {
    await tx.plannedTask.deleteMany({ where: guard });
    return null;
  }

  const current = await tx.plannedTask.findFirst({
    where: guard,
    select: { weeklyPlan: { select: { weekStartDate: true } } },
  });
  if (!current) return null;
  const targetWeek = startOfWeekLocal(move.to);
  const plan = await ensurePlan(tx, targetWeek);
  const { count } = await tx.plannedTask.updateMany({
    where: guard,
    data: {
      weeklyPlanId: plan.id,
      plannedDate: toDbDate(move.to),
      manualOverride: true,
      explanationCode: "CARRIED_OVER",
      startedAt: null,
    },
  });
  const crossWeek = fromDbDate(current.weeklyPlan.weekStartDate) !== targetWeek;
  // Lost a race: another request moved it. Still re-plan a week this may
  // have just created, or it would stay empty.
  if (count === 0 || !crossWeek) return crossWeek ? targetWeek : null;

  // Arriving in another week, it replaces whatever the planner had put there
  // for the task, unless that week has already settled it (done, skipped,
  // taken off or placed by hand); then the leftover gives way instead.
  const others = await tx.plannedTask.findMany({
    where: { weeklyPlanId: plan.id, taskId: move.taskId, id: { not: move.id } },
    select: { id: true, state: true, manualOverride: true },
  });
  const settled = others.some(
    (o) =>
      o.state === "COMPLETED" ||
      o.state === "SKIPPED" ||
      o.state === "REMOVED" ||
      (o.state === "PLANNED" && o.manualOverride),
  );
  if (settled) {
    await tx.plannedTask.delete({ where: { id: move.id } });
    return null;
  }
  if (others.length > 0) {
    await tx.plannedTask.deleteMany({
      where: { id: { in: others.map((o) => o.id) } },
    });
  }
  return targetWeek;
}
