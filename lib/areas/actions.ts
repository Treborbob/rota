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
import { requireUser } from "@/lib/session";
import { formDataToObject } from "@/lib/validation/task";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(60),
});

function revalidate() {
  for (const p of ["/areas", "/tasks", "/tasks/new", "/pick"])
    revalidatePath(p);
}

export async function createArea(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = nameSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return failure("Give it a name.", fieldErrorsFrom(parsed.error));
  }
  const last = await db.area.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await db.area.create({
    data: { name: parsed.data.name, sortOrder: (last?.sortOrder ?? 0) + 10 },
  });
  revalidate();
  return success("Area added.");
}

export async function renameArea(
  areaId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = nameSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return failure("Give it a name.", fieldErrorsFrom(parsed.error));
  }
  await db.area.update({
    where: { id: areaId },
    data: { name: parsed.data.name },
  });
  revalidate();
  return success("Renamed.");
}

/** Swap sort order with the neighbour above or below. */
export async function moveArea(
  areaId: string,
  direction: "up" | "down",
): Promise<ActionState> {
  await requireUser();
  const areas = await db.area.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  const index = areas.findIndex((a) => a.id === areaId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= areas.length) return success();

  // Re-number the whole list so orders stay distinct and well spaced.
  const reordered = [...areas];
  [reordered[index], reordered[swapWith]] = [
    reordered[swapWith],
    reordered[index],
  ];
  await db.$transaction(
    reordered.map((a, i) =>
      db.area.update({
        where: { id: a.id },
        data: { sortOrder: (i + 1) * 10 },
      }),
    ),
  );
  revalidate();
  return success();
}

export async function archiveArea(areaId: string): Promise<ActionState> {
  await requireUser();
  const liveTasks = await db.task.count({
    where: { areaId, archivedAt: null },
  });
  if (liveTasks > 0) {
    return failure(
      `Move or archive its ${liveTasks} task${liveTasks === 1 ? "" : "s"} first.`,
    );
  }
  await db.area.update({ where: { id: areaId }, data: { active: false } });
  revalidate();
  return success("Area archived.");
}

export async function restoreArea(areaId: string): Promise<ActionState> {
  await requireUser();
  await db.area.update({ where: { id: areaId }, data: { active: true } });
  revalidate();
  return success("Area restored.");
}
