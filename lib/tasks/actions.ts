"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type ActionState,
  failure,
  fieldErrorsFrom,
  success,
} from "@/lib/action-state";
import {
  fromDbDate,
  type LocalDate,
  startOfLocalDay,
  toDbDate,
  todayLocal,
} from "@/lib/dates";
import { db } from "@/lib/db";
import {
  initialDueFromLastDone,
  nextDueAfterSkip,
} from "@/lib/domain/recurrence";
import { userMessage } from "@/lib/errors";
import type { Prisma } from "@/lib/generated/prisma/client";
import { replanUpcomingWeeks } from "@/lib/planning/generate";
import { requireUser } from "@/lib/session";
import { recordCompletion } from "@/lib/tasks/complete";
import { recurrenceOf } from "@/lib/tasks/view";
import {
  completeTaskSchema,
  deferTaskSchema,
  formDataToObject,
  type TaskInput,
  taskInputSchema,
} from "@/lib/validation/task";

/** Keep the plan honest, then refresh every screen that shows tasks. */
async function afterTaskChange(taskId?: string) {
  await replanUpcomingWeeks();
  for (const p of ["/", "/week", "/tasks", "/pick", "/history", "/areas"]) {
    revalidatePath(p);
  }
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

/** Map validated form input onto the columns a create or update writes. */
function taskDataFrom(input: TaskInput): Prisma.TaskUncheckedCreateInput {
  const recurring = input.taskType === "RECURRING";
  const recurrence =
    recurring && input.recurrenceValue && input.recurrenceUnit
      ? {
          value: input.recurrenceValue,
          unit: input.recurrenceUnit,
          anchor: input.recurrenceAnchor,
        }
      : null;

  let nextDueOn: LocalDate | null = null;
  let lastCompletedAt: Date | null | undefined;
  if (input.startMode === "FIRST_DUE" && input.startDate) {
    nextDueOn = input.startDate;
  } else if (input.startMode === "LAST_DONE" && input.startDate) {
    lastCompletedAt = startOfLocalDay(input.startDate);
    nextDueOn = recurrence
      ? initialDueFromLastDone({ recurrence, lastDoneOn: input.startDate })
      : null;
  }

  return {
    name: input.name,
    areaId: input.areaId,
    notes: input.notes,
    estimatedMinutes: input.estimatedMinutes,
    priority: input.priority,
    unpleasant: input.unpleasant,
    taskType: input.taskType,
    assignmentMode: input.assignmentMode,
    fixedAssigneeId:
      input.assignmentMode === "FIXED" ? input.fixedAssigneeId : null,
    recurrenceValue: recurrence?.value ?? null,
    recurrenceUnit: recurrence?.unit ?? null,
    recurrenceAnchor: input.recurrenceAnchor,
    dueSoonDays: input.dueSoonDays,
    preferredWeekday: input.preferredWeekday,
    allowedWeekdays: input.allowedWeekdays,
    nextDueOn: toDbDate(nextDueOn),
    ...(lastCompletedAt !== undefined ? { lastCompletedAt } : {}),
  };
}

async function parseTaskForm(formData: FormData) {
  const raw = formDataToObject(formData);
  return taskInputSchema.safeParseAsync(raw);
}

export async function createTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = await parseTaskForm(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields.",
      fieldErrorsFrom(parsed.error),
    );
  }
  const task = await db.task.create({ data: taskDataFrom(parsed.data) });
  await afterTaskChange(task.id);
  redirect(`/tasks/${task.id}`);
}

export async function updateTask(
  taskId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = await parseTaskForm(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields.",
      fieldErrorsFrom(parsed.error),
    );
  }
  const data = taskDataFrom(parsed.data);
  // Editing must not silently rewrite "last done" unless the form asked to.
  if (parsed.data.startMode !== "LAST_DONE") {
    delete (data as { lastCompletedAt?: unknown }).lastCompletedAt;
  }
  await db.task.update({ where: { id: taskId }, data });
  await afterTaskChange(taskId);
  redirect(`/tasks/${taskId}`);
}

export async function duplicateTask(taskId: string): Promise<void> {
  await requireUser();
  const source = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    lastCompletedAt: _l,
    nextDueOn: _n,
    deferredUntil: _d,
    pausedAt: _p,
    archivedAt: _a,
    ...rest
  } = source;
  const copy = await db.task.create({
    data: { ...rest, name: `${source.name} (copy)` },
  });
  await afterTaskChange(copy.id);
  redirect(`/tasks/${copy.id}/edit`);
}

export async function completeTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = completeTaskSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields.",
      fieldErrorsFrom(parsed.error),
    );
  }
  const { taskId, completedOn, actualMinutes, note } = parsed.data;
  const now = new Date();
  // Backdating: use the end of that local day would be misleading; use midday
  // so "completed on Tuesday" lands on Tuesday in any DST regime.
  const completedAt =
    completedOn && completedOn !== todayLocal(now)
      ? new Date(startOfLocalDay(completedOn).getTime() + 12 * 60 * 60 * 1000)
      : now;

  const source = formData.get("source") === "PICK" ? "PICK" : "MANUAL";

  try {
    await db.$transaction((tx) =>
      recordCompletion(tx, {
        taskId,
        userId: user.id,
        completedAt,
        source,
        actualMinutes,
        note,
      }),
    );
  } catch (error) {
    return failure(userMessage(error, "Couldn't record that. Try again."));
  }
  await afterTaskChange(taskId);
  return success("Done. Nice one.");
}

export async function deferTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = deferTaskSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return failure("Pick a date.", fieldErrorsFrom(parsed.error));
  }
  if (parsed.data.until <= todayLocal()) {
    return failure("Pick a date after today.", {
      until: "Must be after today",
    });
  }
  await db.task.update({
    where: { id: parsed.data.taskId },
    data: { deferredUntil: toDbDate(parsed.data.until) },
  });
  await afterTaskChange(parsed.data.taskId);
  return success("Deferred.");
}

export async function clearDeferral(taskId: string): Promise<ActionState> {
  await requireUser();
  await db.task.update({
    where: { id: taskId },
    data: { deferredUntil: null },
  });
  await afterTaskChange(taskId);
  return success("Back on the list.");
}

export async function pauseTask(taskId: string): Promise<ActionState> {
  await requireUser();
  await db.task.update({
    where: { id: taskId },
    data: { pausedAt: new Date(), deferredUntil: null },
  });
  await afterTaskChange(taskId);
  return success("Paused. It won't be planned until you resume it.");
}

export async function resumeTask(taskId: string): Promise<ActionState> {
  await requireUser();
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  const today = todayLocal();
  const current = fromDbDate(task.nextDueOn);
  await db.task.update({
    where: { id: taskId },
    data: {
      pausedAt: null,
      // A long pause shouldn't come back as "four months overdue".
      nextDueOn: current && current < today ? toDbDate(today) : task.nextDueOn,
    },
  });
  await afterTaskChange(taskId);
  return success("Resumed.");
}

export async function skipOccurrence(taskId: string): Promise<ActionState> {
  await requireUser();
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  const recurrence = recurrenceOf(task);
  const current = fromDbDate(task.nextDueOn);
  if (!recurrence || !current) {
    return failure("Only recurring tasks with a due date can be skipped.");
  }
  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        nextDueOn: toDbDate(
          nextDueAfterSkip({ recurrence, currentDueOn: current }),
        ),
        deferredUntil: null,
      },
    });
    await tx.plannedTask.updateMany({
      where: { taskId, state: "PLANNED" },
      data: { state: "SKIPPED" },
    });
  });
  await afterTaskChange(taskId);
  return success("Skipped this time round.");
}

export async function archiveTask(taskId: string): Promise<ActionState> {
  await requireUser();
  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { archivedAt: new Date() },
    });
    await tx.plannedTask.updateMany({
      where: { taskId, state: "PLANNED" },
      data: { state: "REMOVED" },
    });
  });
  await afterTaskChange(taskId);
  return success("Archived.");
}

export async function restoreTask(taskId: string): Promise<ActionState> {
  await requireUser();
  await db.task.update({ where: { id: taskId }, data: { archivedAt: null } });
  await afterTaskChange(taskId);
  return success("Restored.");
}

/** "Use 30 min": adopt the learned typical duration as the estimate. */
export async function updateTaskEstimate(
  taskId: string,
  minutes: number,
): Promise<ActionState> {
  await requireUser();
  const value = Math.round(minutes);
  if (!Number.isFinite(value) || value < 1 || value > 180) {
    return failure("Estimates are 1 to 180 minutes.");
  }
  await db.task.update({
    where: { id: taskId },
    data: { estimatedMinutes: value },
  });
  await afterTaskChange(taskId);
  return success(`Estimate is now ${value} min.`);
}
