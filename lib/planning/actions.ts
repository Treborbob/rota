"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type ActionState,
  failure,
  fieldErrorsFrom,
  success,
} from "@/lib/action-state";
import {
  addDaysLocal,
  daysBetween,
  formatDayAhead,
  fromDbDate,
  isLocalDate,
  startOfWeekLocal,
  toDbDate,
  todayLocal,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { pushTarget } from "@/lib/domain/carry-over";
import { elapsedMinutes } from "@/lib/domain/duration";
import { DomainError, userMessage } from "@/lib/errors";
import { listMembers } from "@/lib/members";
import { loadAwayDays } from "@/lib/planning/capacity";
import { moveCarried } from "@/lib/planning/carry-over";
import { generatePlan, replanUpcomingWeeks } from "@/lib/planning/generate";
import { currentWeekStart } from "@/lib/planning/queries";
import { requireUser } from "@/lib/session";
import { skipOccurrence } from "@/lib/tasks/actions";
import { recordCompletion } from "@/lib/tasks/complete";
import { formDataToObject } from "@/lib/validation/task";

function revalidatePlanPaths(weekStart?: string) {
  for (const p of ["/", "/week", "/tasks", "/pick", "/history", "/settings"]) {
    revalidatePath(p);
  }
  if (weekStart) revalidatePath(`/week/${weekStart}`);
}

async function weekStartOfItem(plannedTaskId: string): Promise<string> {
  const item = await db.plannedTask.findUniqueOrThrow({
    where: { id: plannedTaskId },
    select: { weeklyPlan: { select: { weekStartDate: true } } },
  });
  return fromDbDate(item.weeklyPlan.weekStartDate);
}

export async function regeneratePlan(weekStart: string): Promise<ActionState> {
  await requireUser();
  if (!isLocalDate(weekStart)) return failure("Bad week.");
  try {
    await generatePlan(weekStart);
  } catch (error) {
    return failure(userMessage(error, "Couldn't plan the week. Try again."));
  }
  revalidatePlanPaths(weekStart);
  return success("Week planned.");
}

/** One-tap done from Tonight or Week. Idempotent: a second tap is a no-op. */
export async function completePlannedItem(
  plannedTaskId: string,
  actualMinutes?: number | null,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await db.$transaction(async (tx) => {
      const item = await tx.plannedTask.findUniqueOrThrow({
        where: { id: plannedTaskId },
      });
      if (item.state === "COMPLETED") return;
      if (item.state !== "PLANNED" && item.state !== "UNSCHEDULED") {
        throw new DomainError("That item isn't on the plan any more.");
      }
      const now = new Date();
      // A running timer beats a guess; an explicit figure beats both.
      const minutes =
        actualMinutes ??
        (item.startedAt ? elapsedMinutes(item.startedAt, now) : null);
      await recordCompletion(tx, {
        taskId: item.taskId,
        userId: user.id,
        completedAt: now,
        source: "PLAN",
        actualMinutes: minutes,
        plannedTaskId: item.id,
      });
    });
  } catch (error) {
    return failure(userMessage(error, "Couldn't mark that done. Try again."));
  }
  revalidatePlanPaths(await weekStartOfItem(plannedTaskId));
  return success("Done. Nice one.");
}

/** Tap Start when you begin; Done then records how long it took. */
export async function startPlannedItem(
  plannedTaskId: string,
): Promise<ActionState> {
  await requireUser();
  await db.plannedTask.updateMany({
    where: { id: plannedTaskId, state: "PLANNED", startedAt: null },
    data: { startedAt: new Date() },
  });
  revalidatePlanPaths(await weekStartOfItem(plannedTaskId));
  return success();
}

export async function cancelStart(plannedTaskId: string): Promise<ActionState> {
  await requireUser();
  await db.plannedTask.updateMany({
    where: { id: plannedTaskId },
    data: { startedAt: null },
  });
  revalidatePlanPaths(await weekStartOfItem(plannedTaskId));
  return success();
}

export async function removePlannedItem(
  plannedTaskId: string,
): Promise<ActionState> {
  await requireUser();
  await db.plannedTask.update({
    where: { id: plannedTaskId },
    data: { state: "REMOVED" },
  });
  revalidatePlanPaths(await weekStartOfItem(plannedTaskId));
  return success("Taken off this week. It's still due.");
}

export async function skipPlannedItem(
  plannedTaskId: string,
): Promise<ActionState> {
  await requireUser();
  const item = await db.plannedTask.findUniqueOrThrow({
    where: { id: plannedTaskId },
    select: { taskId: true },
  });
  // skipOccurrence advances the task and marks its PLANNED items SKIPPED.
  const result = await skipOccurrence(item.taskId);
  revalidatePlanPaths(await weekStartOfItem(plannedTaskId));
  return result;
}

/**
 * "Not tonight": today's job goes to its owner's next day that they aren't
 * away, on top of that day's plan, even a Friday or next Monday.
 */
export async function pushPlannedItem(
  plannedTaskId: string,
): Promise<ActionState> {
  await requireUser();
  const today = todayLocal();
  const item = await db.plannedTask.findUniqueOrThrow({
    where: { id: plannedTaskId },
    select: {
      taskId: true,
      state: true,
      plannedDate: true,
      assignedToId: true,
      weeklyPlan: { select: { weekStartDate: true } },
    },
  });
  if (
    item.state !== "PLANNED" ||
    !item.assignedToId ||
    fromDbDate(item.plannedDate) !== today
  ) {
    return failure("Only tonight's jobs can be pushed to another day.");
  }
  const away = await loadAwayDays([item.assignedToId], today);
  const to = pushTarget(item.assignedToId, today, away);
  try {
    await moveCarried([
      { id: plannedTaskId, taskId: item.taskId, from: today, to },
    ]);
  } catch (error) {
    return failure(userMessage(error, "Couldn't move that. Try again."));
  }
  revalidatePlanPaths(fromDbDate(item.weeklyPlan.weekStartDate));
  revalidatePlanPaths(startOfWeekLocal(to));
  return success(`Moved to ${formatDayAhead(to, today)}.`);
}

const moveSchema = z.object({
  plannedTaskId: z.string().min(1),
  date: z.string().refine(isLocalDate, "Pick a day"),
  userId: z.string().min(1, "Pick who"),
});

/** Move and/or reassign by hand. The item is then pinned against regeneration. */
export async function movePlannedItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = moveSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return failure("Pick a day and a person.", fieldErrorsFrom(parsed.error));
  }
  const { plannedTaskId, date, userId } = parsed.data;
  const item = await db.plannedTask.findUniqueOrThrow({
    where: { id: plannedTaskId },
    include: { weeklyPlan: { select: { weekStartDate: true } } },
  });
  const weekStart = fromDbDate(item.weeklyPlan.weekStartDate);
  if (date < weekStart || date > addDaysLocal(weekStart, 6)) {
    return failure("That day isn't in this week.");
  }
  if (item.state !== "PLANNED" && item.state !== "UNSCHEDULED") {
    return failure("That item isn't on the plan any more.");
  }
  await db.plannedTask.update({
    where: { id: plannedTaskId },
    data: {
      plannedDate: toDbDate(date),
      assignedToId: userId,
      state: "PLANNED",
      manualOverride: true,
      explanationCode:
        item.state === "UNSCHEDULED" ? "PINNED" : item.explanationCode,
    },
  });
  revalidatePlanPaths(weekStart);
  return success("Moved.");
}

/** Put a task into a week by hand; the planner finds it a slot or explains why not. */
export async function addTaskToWeek(
  weekStart: string,
  taskId: string,
): Promise<ActionState> {
  await requireUser();
  if (!isLocalDate(weekStart)) return failure("Bad week.");
  try {
    await generatePlan(weekStart, { pinTaskIds: [taskId] });
  } catch (error) {
    return failure(userMessage(error, "Couldn't add that. Try again."));
  }
  revalidatePlanPaths(weekStart);
  return success("Added to the week.");
}

const overrideSchema = z.object({
  userId: z.string().min(1),
  date: z.string().refine(isLocalDate, "Pick a day"),
  minutes: z.coerce.number().int().min(0).max(600),
  note: z
    .string()
    .trim()
    .max(120)
    .transform((s) => (s.length ? s : null))
    .default(null),
});

/**
 * "Out on Tuesday" / "only 15 minutes tonight". Saves the override and
 * re-plans the week around it, keeping completed and hand-placed work.
 */
export async function setCapacityOverride(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = overrideSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return failure("Check the minutes.", fieldErrorsFrom(parsed.error));
  }
  const { userId, date, minutes, note } = parsed.data;
  const reset = formData.get("reset") === "1";
  if (reset) {
    await db.capacityOverride.deleteMany({
      where: { userId, localDate: toDbDate(date) },
    });
  } else {
    await db.capacityOverride.upsert({
      where: { userId_localDate: { userId, localDate: toDbDate(date) } },
      create: { userId, localDate: toDbDate(date), minutes, note },
      update: { minutes, note },
    });
  }
  const weekStart = currentWeekStart(date);
  if (weekStart >= currentWeekStart(todayLocal())) {
    await generatePlan(weekStart);
  }
  revalidatePlanPaths(weekStart);
  return success(reset ? "Back to the usual." : "Updated and re-planned.");
}

const awaySchema = z.object({
  who: z.string().min(1, "Pick who"),
  from: z.string().refine(isLocalDate, "Pick a day"),
  to: z.string().refine(isLocalDate, "Pick a day"),
});

/** Longest single away range, so a typo in the year can't write 400 rows. */
const MAX_AWAY_DAYS = 62;

/**
 * A holiday: 0-minute overrides for every day in the range, so nothing is
 * planned and carried jobs wait for the first day back. "Not away after
 * all" clears the 0-minute overrides in the range instead.
 */
export async function setAway(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = awaySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return failure("Pick who and the days.", fieldErrorsFrom(parsed.error));
  }
  const { who, from, to } = parsed.data;
  if (from < todayLocal()) {
    return failure("Pick today or later.", { from: "Today or later" });
  }
  if (to < from) {
    return failure("The last day is before the first.", {
      to: "On or after the first day",
    });
  }
  if (daysBetween(from, to) >= MAX_AWAY_DAYS) {
    return failure("Two months at most at a time.", {
      to: "Within two months of the first day",
    });
  }
  const members = await listMembers();
  const userIds = members
    .filter((m) => who === "all" || m.id === who)
    .map((m) => m.id);
  if (userIds.length === 0) return failure("Pick who.", { who: "Pick who" });

  const back = formData.get("back") === "1";
  if (back) {
    await db.capacityOverride.deleteMany({
      where: {
        userId: { in: userIds },
        minutes: 0,
        localDate: { gte: toDbDate(from), lte: toDbDate(to) },
      },
    });
  } else {
    const dates = Array.from({ length: daysBetween(from, to) + 1 }, (_, i) =>
      addDaysLocal(from, i),
    );
    await db.$transaction(
      userIds.flatMap((userId) =>
        dates.map((date) =>
          db.capacityOverride.upsert({
            where: { userId_localDate: { userId, localDate: toDbDate(date) } },
            create: {
              userId,
              localDate: toDbDate(date),
              minutes: 0,
              note: "Away",
            },
            update: { minutes: 0, note: "Away" },
          }),
        ),
      ),
    );
  }
  await replanUpcomingWeeks();
  revalidatePlanPaths();
  return success(
    back
      ? "Back to the usual minutes."
      : "Marked away. The plan works around it.",
  );
}
