/**
 * Turns database state into planner input, runs the pure planner, and
 * persists the result. Regeneration preserves completed work, manual
 * placements, skips and removals, and re-plans everything else.
 */
import {
  addDaysLocal,
  fromDbDate,
  type LocalDate,
  startOfLocalDay,
  startOfWeekLocal,
  toDbDate,
  todayLocal,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { effectiveMinutes, MAX_SAMPLES } from "@/lib/domain/duration";
import {
  isHeavy,
  type PlannerInput,
  type PlannerTask,
  type PreservedPlacement,
  planWeek,
} from "@/lib/domain/planner";
import { ALGORITHM_VERSION } from "@/lib/domain/planner-config";
import type { Prisma } from "@/lib/generated/prisma/client";
import { listMembers } from "@/lib/members";
import { loadCapacityCells, toBuckets } from "@/lib/planning/capacity";
import { getDueSoonDaysDefault } from "@/lib/tasks/queries";

type Tx = Prisma.TransactionClient;

type SnapshotShape = { pinnedTaskIds?: string[] };

async function loadPlannerTasks(
  dueSoonDaysDefault: number,
): Promise<PlannerTask[]> {
  const tasks = await db.task.findMany({
    where: { archivedAt: null, pausedAt: null },
    include: {
      completions: {
        where: { voidedAt: null },
        orderBy: { completedAt: "desc" },
        take: MAX_SAMPLES,
        select: { completedById: true, actualMinutes: true },
      },
    },
  });
  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    // Plan with what the job actually takes once we know; see lib/domain/duration.
    estimatedMinutes: effectiveMinutes(
      t.estimatedMinutes,
      t.completions
        .map((c) => c.actualMinutes)
        .filter((m): m is number => m !== null),
    ).minutes,
    priority: t.priority,
    unpleasant: t.unpleasant,
    assignmentMode: t.assignmentMode,
    fixedAssigneeId: t.fixedAssigneeId,
    nextDueOn: fromDbDate(t.nextDueOn),
    dueSoonDays: t.dueSoonDays ?? dueSoonDaysDefault,
    preferredWeekday: t.preferredWeekday,
    allowedWeekdays: t.allowedWeekdays,
    deferredUntil: fromDbDate(t.deferredUntil),
    lastCompletedById: t.completions[0]?.completedById ?? null,
  }));
}

/** Completed minutes per member over the 28 days before the week starts. */
async function loadRecentMinutes(
  weekStart: LocalDate,
): Promise<Record<string, number>> {
  const rows = await db.taskCompletion.findMany({
    where: {
      voidedAt: null,
      completedAt: {
        gte: startOfLocalDay(addDaysLocal(weekStart, -28)),
        lt: startOfLocalDay(weekStart),
      },
    },
    select: {
      completedById: true,
      actualMinutes: true,
      task: { select: { estimatedMinutes: true } },
    },
  });
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.completedById] =
      (out[r.completedById] ?? 0) +
      (r.actualMinutes ?? r.task.estimatedMinutes);
  }
  return out;
}

/**
 * Generate or regenerate the plan for a week. Idempotent on weekStart.
 * Returns the plan id.
 */
export async function generatePlan(
  weekStart: LocalDate,
  options: { pinTaskIds?: string[]; today?: LocalDate } = {},
): Promise<string> {
  const today = options.today ?? todayLocal();
  const members = await listMembers();
  const dueSoonDaysDefault = await getDueSoonDaysDefault();
  const [cells, tasks, recentMinutes] = await Promise.all([
    loadCapacityCells(
      weekStart,
      members.map((m) => m.id),
    ),
    loadPlannerTasks(dueSoonDaysDefault),
    loadRecentMinutes(weekStart),
  ]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  return db.$transaction(async (tx: Tx) => {
    // Idempotent create: the unique constraint on weekStartDate wins any race.
    const plan = await tx.weeklyPlan.upsert({
      where: { weekStartDate: toDbDate(weekStart) },
      create: {
        weekStartDate: toDbDate(weekStart),
        generatedAt: new Date(),
        algorithmVersion: ALGORITHM_VERSION,
        inputSnapshot: {},
      },
      update: {},
      include: { items: true },
    });

    const previousPinned = ((plan.inputSnapshot as SnapshotShape | null)
      ?.pinnedTaskIds ?? []) as string[];
    const pinnedTaskIds = [
      ...new Set([...previousPinned, ...(options.pinTaskIds ?? [])]),
    ];

    const preserved: PreservedPlacement[] = [];
    const excludedTaskIds = new Set<string>();
    const replaceableIds: string[] = [];

    for (const item of plan.items) {
      const keep =
        item.state === "COMPLETED" ||
        (item.state === "PLANNED" && item.manualOverride);
      if (keep && item.plannedDate && item.assignedToId) {
        const t = taskById.get(item.taskId);
        preserved.push({
          taskId: item.taskId,
          userId: item.assignedToId,
          date: fromDbDate(item.plannedDate),
          minutes: item.estimatedMinutesSnapshot,
          heavy: t ? isHeavy(t) : item.estimatedMinutesSnapshot >= 30,
        });
        excludedTaskIds.add(item.taskId);
      } else if (item.state === "SKIPPED" || item.state === "REMOVED") {
        excludedTaskIds.add(item.taskId);
      } else {
        replaceableIds.push(item.id);
      }
    }

    const input: PlannerInput = {
      weekStart,
      today,
      members,
      buckets: toBuckets(cells),
      tasks: tasks.filter((t) => !excludedTaskIds.has(t.id)),
      pinnedTaskIds: pinnedTaskIds.filter((id) => !excludedTaskIds.has(id)),
      recentMinutes,
      preserved,
    };
    const output = planWeek(input);

    if (replaceableIds.length > 0) {
      await tx.plannedTask.deleteMany({
        where: { id: { in: replaceableIds } },
      });
    }

    const rows: Prisma.PlannedTaskCreateManyInput[] = [];
    for (const p of output.placements) {
      const t = taskById.get(p.taskId);
      if (!t) continue;
      rows.push({
        weeklyPlanId: plan.id,
        taskId: p.taskId,
        plannedDate: toDbDate(p.date),
        assignedToId: p.userId,
        estimatedMinutesSnapshot: t.estimatedMinutes,
        prioritySnapshot: t.priority,
        dueOnSnapshot: toDbDate(t.nextDueOn),
        scoreSnapshot: p.score,
        explanationCode: p.code,
        sortOrder: p.sortOrder,
        state: "PLANNED",
      });
    }
    for (const u of output.unscheduled) {
      const t = taskById.get(u.taskId);
      if (!t) continue;
      rows.push({
        weeklyPlanId: plan.id,
        taskId: u.taskId,
        plannedDate: null,
        assignedToId: null,
        estimatedMinutesSnapshot: t.estimatedMinutes,
        prioritySnapshot: t.priority,
        dueOnSnapshot: toDbDate(t.nextDueOn),
        scoreSnapshot: u.score,
        explanationCode: u.code,
        sortOrder: 0,
        state: "UNSCHEDULED",
      });
    }
    if (rows.length > 0) await tx.plannedTask.createMany({ data: rows });

    await tx.weeklyPlan.update({
      where: { id: plan.id },
      data: {
        generatedAt: new Date(),
        algorithmVersion: ALGORITHM_VERSION,
        inputSnapshot: {
          ...output.snapshot,
          pinnedTaskIds,
        } as Prisma.InputJsonValue,
      },
    });

    console.info(
      `[planner] week=${weekStart} version=${ALGORITHM_VERSION} candidates=${output.snapshot.candidateCount} placed=${output.placements.length} overflow=${output.unscheduled.length} preserved=${preserved.length}`,
    );
    return plan.id;
  });
}

/**
 * Re-plan every week from the current one onwards that already has a plan.
 * Called after anything that changes what is due or who is free, so the
 * plan never silently drifts from the task list. Completed and hand-placed
 * work is preserved by generatePlan.
 */
export async function replanUpcomingWeeks(): Promise<void> {
  const from = startOfWeekLocal(todayLocal());
  const plans = await db.weeklyPlan.findMany({
    where: { weekStartDate: { gte: toDbDate(from) } },
    select: { weekStartDate: true },
  });
  for (const plan of plans) {
    await generatePlan(fromDbDate(plan.weekStartDate));
  }
}
