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
