"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type ActionState,
  failure,
  fieldErrorsFrom,
  success,
} from "@/lib/action-state";
import { db } from "@/lib/db";
import { generatePlan } from "@/lib/planning/generate";
import { currentWeekStart } from "@/lib/planning/queries";
import { requireUser } from "@/lib/session";
import { formDataToObject } from "@/lib/validation/task";

const capacitySchema = z.object({
  d1: z.coerce.number().int().min(0).max(600),
  d2: z.coerce.number().int().min(0).max(600),
  d3: z.coerce.number().int().min(0).max(600),
  d4: z.coerce.number().int().min(0).max(600),
  d5: z.coerce.number().int().min(0).max(600),
  d6: z.coerce.number().int().min(0).max(600),
  d7: z.coerce.number().int().min(0).max(600),
});

/** A member's default minutes per weekday. Re-plans the current week. */
export async function updateWeekdayCapacity(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = capacitySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return failure(
      "Minutes must be whole numbers.",
      fieldErrorsFrom(parsed.error),
    );
  }
  const values = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    weekday: d,
    minutes: parsed.data[`d${d}` as keyof typeof parsed.data],
  }));
  await db.$transaction(
    values.map((v) =>
      db.weekdayCapacity.upsert({
        where: { userId_weekday: { userId, weekday: v.weekday } },
        create: { userId, weekday: v.weekday, minutes: v.minutes },
        update: { minutes: v.minutes },
      }),
    ),
  );
  await generatePlan(currentWeekStart());
  for (const p of ["/", "/week", "/settings"]) revalidatePath(p);
  return success("Saved and this week re-planned.");
}

const householdSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(60),
  dueSoonDaysDefault: z.coerce.number().int().min(0).max(90),
});

export async function updateHousehold(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = householdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return failure("Check the fields.", fieldErrorsFrom(parsed.error));
  }
  const household = await db.household.findFirst({ select: { id: true } });
  if (!household) return failure("No household yet. Run the seed.");
  await db.household.update({ where: { id: household.id }, data: parsed.data });
  for (const p of ["/", "/week", "/tasks", "/pick", "/settings"])
    revalidatePath(p);
  return success("Saved.");
}
