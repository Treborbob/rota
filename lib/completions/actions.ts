"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionState,
  failure,
  fieldErrorsFrom,
  success,
} from "@/lib/action-state";
import { db } from "@/lib/db";
import { replanUpcomingWeeks } from "@/lib/planning/generate";
import { requireUser } from "@/lib/session";
import { voidCompletion } from "@/lib/tasks/complete";
import { formDataToObject, voidCompletionSchema } from "@/lib/validation/task";

export async function voidCompletionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = voidCompletionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return failure(
      "Say why it's being removed.",
      fieldErrorsFrom(parsed.error),
    );
  }
  const completion = await db.$transaction(async (tx) => {
    await voidCompletion(tx, {
      completionId: parsed.data.completionId,
      userId: user.id,
      reason: parsed.data.reason,
      now: new Date(),
    });
    return tx.taskCompletion.findUniqueOrThrow({
      where: { id: parsed.data.completionId },
      select: { taskId: true },
    });
  });
  await replanUpcomingWeeks();
  for (const p of [
    "/",
    "/week",
    "/tasks",
    "/pick",
    "/history",
    `/tasks/${completion.taskId}`,
  ]) {
    revalidatePath(p);
  }
  return success("Removed from history.");
}

/** Adjust how long a completion took: the after-the-fact "actually, 30 min". */
export async function updateCompletionMinutes(
  completionId: string,
  minutes: number | null,
): Promise<ActionState> {
  await requireUser();
  const value =
    minutes === null ? null : Math.min(600, Math.max(1, Math.round(minutes)));
  if (value !== null && !Number.isFinite(value)) {
    return failure("Enter a number of minutes.");
  }
  const completion = await db.taskCompletion.update({
    where: { id: completionId },
    data: { actualMinutes: value },
    select: { taskId: true },
  });
  for (const p of ["/", "/week", "/history", `/tasks/${completion.taskId}`]) {
    revalidatePath(p);
  }
  return success(value === null ? "Time cleared." : `Noted: ${value} min.`);
}
