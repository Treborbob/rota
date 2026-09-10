/**
 * The two transactions that touch completion history. Everything else that
 * "does" a task (Tonight, Pick, the catalogue, a plan item) goes through
 * recordCompletion so recurrence and history can never drift apart.
 */
import { fromDbDate, toDbDate, toLocalDate } from "@/lib/dates";
import { nextDueAfterCompletion } from "@/lib/domain/recurrence";
import { DomainError } from "@/lib/errors";
import type {
  CompletionSource,
  Prisma,
  TaskCompletion,
} from "@/lib/generated/prisma/client";
import { recurrenceOf } from "@/lib/tasks/view";

type Tx = Prisma.TransactionClient;

export async function recordCompletion(
  tx: Tx,
  params: {
    taskId: string;
    userId: string;
    completedAt: Date;
    source: CompletionSource;
    actualMinutes?: number | null;
    note?: string | null;
    plannedTaskId?: string | null;
  },
): Promise<TaskCompletion> {
  const task = await tx.task.findUniqueOrThrow({
    where: { id: params.taskId },
  });
  if (task.archivedAt) {
    throw new DomainError("This task is archived.");
  }

  const completion = await tx.taskCompletion.create({
    data: {
      taskId: task.id,
      completedById: params.userId,
      completedAt: params.completedAt,
      previousDueOn: task.nextDueOn,
      previousLastCompletedAt: task.lastCompletedAt,
      actualMinutes: params.actualMinutes ?? null,
      note: params.note ?? null,
      source: params.source,
    },
  });

  const recurrence = recurrenceOf(task);
  const nextDueOn = recurrence
    ? toDbDate(
        nextDueAfterCompletion({
          recurrence,
          previousDueOn: fromDbDate(task.nextDueOn),
          completedOn: toLocalDate(params.completedAt),
        }),
      )
    : task.nextDueOn;

  const lastCompletedAt =
    task.lastCompletedAt && task.lastCompletedAt > params.completedAt
      ? task.lastCompletedAt
      : params.completedAt;

  await tx.task.update({
    where: { id: task.id },
    data: {
      lastCompletedAt,
      nextDueOn,
      deferredUntil: null,
      // A one-off is finished once it's done.
      archivedAt:
        task.taskType === "ONE_OFF" ? params.completedAt : task.archivedAt,
    },
  });

  // If this task is sitting in a plan, mark that item done too.
  const planned = params.plannedTaskId
    ? await tx.plannedTask.findUnique({ where: { id: params.plannedTaskId } })
    : await tx.plannedTask.findFirst({
        where: { taskId: task.id, state: "PLANNED" },
        orderBy: { plannedDate: "desc" },
      });
  if (planned && planned.state === "PLANNED") {
    await tx.plannedTask.update({
      where: { id: planned.id },
      data: { state: "COMPLETED", completionId: completion.id },
    });
  }

  return completion;
}

export async function voidCompletion(
  tx: Tx,
  params: { completionId: string; userId: string; reason: string; now: Date },
): Promise<void> {
  const completion = await tx.taskCompletion.findUniqueOrThrow({
    where: { id: params.completionId },
    include: { plannedTask: true },
  });
  if (completion.voidedAt) return; // already done; idempotent

  await tx.taskCompletion.update({
    where: { id: completion.id },
    data: {
      voidedAt: params.now,
      voidedById: params.userId,
      voidReason: params.reason,
    },
  });

  const latestValid = await tx.taskCompletion.findFirst({
    where: { taskId: completion.taskId, voidedAt: null },
    orderBy: { completedAt: "desc" },
  });

  const wasLatest =
    !latestValid || latestValid.completedAt <= completion.completedAt;

  if (wasLatest) {
    const task = await tx.task.findUniqueOrThrow({
      where: { id: completion.taskId },
    });
    await tx.task.update({
      where: { id: task.id },
      data: {
        // Prefer the exact snapshot; fall back to the newest surviving
        // completion for rows written before snapshots existed.
        lastCompletedAt:
          completion.previousLastCompletedAt ??
          latestValid?.completedAt ??
          null,
        nextDueOn: completion.previousDueOn,
        archivedAt:
          task.taskType === "ONE_OFF" &&
          task.archivedAt?.getTime() === completion.completedAt.getTime()
            ? null
            : task.archivedAt,
      },
    });
  }

  if (completion.plannedTask) {
    await tx.plannedTask.update({
      where: { id: completion.plannedTask.id },
      data: { state: "PLANNED", completionId: null },
    });
  }
}
